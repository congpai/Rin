import { count, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { momentComments, moments } from "../db/schema";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { cleanupRemovedImagesFromPreviousContent, cleanupUnreferencedImagesFromContents } from "../utils/storage-image-cleanup";
import { bindTagToMoment } from "./tag";
import { MAX_MOMENT_TAGS, normalizeTagNames } from "../utils/tag-names";

function formatMomentRow(row: {
    hashtags?: Array<{ hashtag: { id: number; name: string } }>;
    [key: string]: unknown;
}) {
    const { hashtags, ...other } = row;
    return {
        ...other,
        hashtags: (hashtags ?? []).map(({ hashtag }) => hashtag),
    };
}

export function MomentsService(): Hono {
    const app = new Hono();

    // GET /moments
    app.get('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const admin = c.get('admin');
        const page = c.req.query('page');
        const limit = c.req.query('limit');
        const filter = c.req.query('filter');

        const page_num = (page ? parseInt(page) > 0 ? parseInt(page) : 1 : 1) - 1;
        const limit_num = limit ? parseInt(limit) > 50 ? 50 : parseInt(limit) : 20;
        // Private moments are only visible to the admin; key the cache by viewer
        // role so the public cache never contains private items. Admins can also
        // filter to show only their private ("仅自己可看") moments.
        const privateOnly = admin && filter === 'private';
        const visibilityFilter = privateOnly
            ? eq(moments.private, 1)
            : admin
                ? undefined
                : eq(moments.private, 0);
        const cacheKey = `moments_v2_${admin ? (privateOnly ? 'admin_private' : 'admin') : 'pub'}_${page_num}_${limit_num}`;
        const cached = await profileAsync(c, 'moments_list_cache_get', () => cache.get(cacheKey));

        if (cached) {
            return c.json(cached);
        }

        const size = await profileAsync(c, 'moments_list_count', () => db.select({ count: count() }).from(moments).where(visibilityFilter));

        if (size[0].count === 0) {
            return c.json({ size: 0, data: [], hasNext: false });
        }

        const moments_list = await profileAsync(c, 'moments_list_db', () => db.query.moments.findMany({
            where: visibilityFilter,
            with: {
                user: { columns: { id: true, username: true, avatar: true } },
                hashtags: {
                    columns: {},
                    with: { hashtag: { columns: { id: true, name: true } } },
                },
            },
            orderBy: [desc(moments.createdAt)],
            offset: page_num * limit_num,
            limit: limit_num + 1,
        }));
        
        let hasNext = false;
        if (moments_list.length === limit_num + 1) {
            moments_list.pop();
            hasNext = true;
        }
        
        const data = {
            size: size[0].count,
            data: moments_list.map(formatMomentRow),
            hasNext,
        };
        await profileAsync(c, 'moments_list_cache_set', () => cache.set(cacheKey, data));
        return c.json(data);
    });

    // POST /moments
    app.post('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const body = await profileAsync(c, 'moments_create_parse', () => c.req.json());
        const { content, tags, private: isPrivate } = body;

        if (!uid) {
            return c.text('Unauthorized', 401);
        }

        if (!admin) {
            return c.text('Permission denied', 403);
        }

        if (!content) {
            return c.text('Content is required', 400);
        }

        const normalizedTags = normalizeTagNames(tags, MAX_MOMENT_TAGS);
        if (Array.isArray(tags) && tags.length > MAX_MOMENT_TAGS) {
            return c.text(`At most ${MAX_MOMENT_TAGS} tags are allowed`, 400);
        }

        const date = new Date();
        const result = await profileAsync(c, 'moments_create_insert', () => db.insert(moments).values({
            content, uid, private: isPrivate ? 1 : 0, createdAt: date, updatedAt: date
        }).returning({ insertedId: moments.id }));
        
        if (result.length === 0) {
            return c.text('Failed to insert', 500);
        }

        const momentId = result[0].insertedId;
        await profileAsync(c, 'moments_create_tags', () => bindTagToMoment(db, momentId, normalizedTags));
        await profileAsync(c, 'moments_create_cache_invalidate', () => cache.deletePrefix('moments_'));
        
        return c.json({ insertedId: momentId });
    });

    // POST /moments/:id
    app.post('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const env = c.get('env');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        const body = await profileAsync(c, 'moments_update_parse', () => c.req.json());
        const { content, tags, private: isPrivate } = body;
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_update_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }
        
        if (!content) {
            return c.text('Content is required', 400);
        }

        const normalizedTags = normalizeTagNames(tags, MAX_MOMENT_TAGS);
        if (Array.isArray(tags) && tags.length > MAX_MOMENT_TAGS) {
            return c.text(`At most ${MAX_MOMENT_TAGS} tags are allowed`, 400);
        }
        
        await profileAsync(c, 'moments_update_db', () => db.update(moments).set({
            content,
            ...(isPrivate === undefined ? {} : { private: isPrivate ? 1 : 0 }),
            updatedAt: new Date()
        }).where(eq(moments.id, id_num)));

        if (tags !== undefined) {
            await profileAsync(c, 'moments_update_tags', () => bindTagToMoment(db, id_num, normalizedTags));
        }
        
        await profileAsync(c, 'moments_update_cache_invalidate', () => cache.deletePrefix('moments_'));

        if (content !== moment.content) {
            await profileAsync(c, 'moments_update_storage_cleanup', () => cleanupRemovedImagesFromPreviousContent(
                db,
                env,
                moment.content,
                content,
            ));
        }

        return c.text('Updated');
    });

    // DELETE /moments/:id
    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');
        const env = c.get('env');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const id = c.req.param('id');
        
        if (!uid) {
            return c.text('Unauthorized', 401);
        }
        
        if (!admin) {
            return c.text('Permission denied', 403);
        }
        
        const id_num = parseInt(id);
        const moment = await profileAsync(c, 'moments_delete_lookup', () => db.query.moments.findFirst({ where: eq(moments.id, id_num) }));
        
        if (!moment) {
            return c.text('Not found', 404);
        }

        const relatedComments = await profileAsync(c, 'moments_delete_comments', () => db.query.momentComments.findMany({
            where: eq(momentComments.momentId, id_num),
            columns: { content: true },
        }));
        const contentsToScan = [
            moment.content,
            ...relatedComments.map((row) => row.content),
        ];
        
        await profileAsync(c, 'moments_delete_db', () => db.delete(moments).where(eq(moments.id, id_num)));
        await profileAsync(c, 'moments_delete_cache_invalidate', () => cache.deletePrefix('moments_'));
        await profileAsync(c, 'moments_delete_storage_cleanup', () => cleanupUnreferencedImagesFromContents(db, env, contentsToScan));
        return c.text('Deleted');
    });

    return app;
}
