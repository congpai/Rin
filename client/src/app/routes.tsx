import { lazy, Suspense, useContext, type ReactNode } from "react";
import type { DefaultParams, PathPattern } from "wouter";
import { Route, Switch } from "wouter";
import { AdminLayout } from "../components/admin-layout";
import Footer from "../components/footer";
import { Header } from "../components/header";
import { PageLoading } from "../components/page-loading";
import { Padding } from "../components/padding";
import { getHeaderLayoutDefinition } from "../components/site-header/layout-registry";
import { Tips, TipsPage } from "../components/tips";
import useTableOfContents from "../hooks/useTableOfContents";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { FeedTocHeader } from "../components/feed_toc_header";
import { FeedsPage } from "../page/feeds";
import { ProfileContext } from "../state/profile";
import { tryInt } from "../utils/int";
import { useTranslation } from "react-i18next";

const TimelinePage = lazy(() => import("../page/timeline").then((module) => ({ default: module.TimelinePage })));
const MomentsPage = lazy(() => import("../page/moments").then((module) => ({ default: module.MomentsPage })));
const FriendsPage = lazy(() => import("../page/friends").then((module) => ({ default: module.FriendsPage })));
const HashtagsPage = lazy(() => import("../page/hashtags").then((module) => ({ default: module.HashtagsPage })));
const HashtagPage = lazy(() => import("../page/hashtag").then((module) => ({ default: module.HashtagPage })));
const SearchPage = lazy(() => import("../page/search").then((module) => ({ default: module.SearchPage })));
const Settings = lazy(() => import("../page/settings").then((module) => ({ default: module.Settings })));
const HealthPage = lazy(() => import("../page/health").then((module) => ({ default: module.HealthPage })));
const QueueStatusPage = lazy(() => import("../page/queue-status").then((module) => ({ default: module.QueueStatusPage })));
const CompatTasksPage = lazy(() => import("../page/compat-tasks").then((module) => ({ default: module.CompatTasksPage })));
const WritingPage = lazy(() => import("../page/writing").then((module) => ({ default: module.WritingPage })));
const CallbackPage = lazy(() => import("../page/callback").then((module) => ({ default: module.CallbackPage })));
const LoginPage = lazy(() => import("../page/login").then((module) => ({ default: module.LoginPage })));
const ProfilePage = lazy(() => import("../page/profile").then((module) => ({ default: module.ProfilePage })));
const FeedPage = lazy(() => import("../page/feed").then((module) => ({ default: module.FeedPage })));
const ErrorPage = lazy(() => import("../page/error").then((module) => ({ default: module.ErrorPage })));

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}

export function AppRoutes() {
  const { t } = useTranslation();

  return (
    <Switch>
      <AppRoute path="/">
        <FeedsPage />
      </AppRoute>

      <AppRoute path="/timeline">
        <LazyRoute><TimelinePage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/moments">
        <LazyRoute><MomentsPage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/friends">
        <LazyRoute><FriendsPage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/hashtags">
        <LazyRoute><HashtagsPage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/hashtag/:name">
        {(params) => (
          <LazyRoute>
            <HashtagPage name={params.name || ""} />
          </LazyRoute>
        )}
      </AppRoute>

      <AppRoute path="/search/:keyword">
        {(params) => (
          <LazyRoute>
            <SearchPage keyword={params.keyword || ""} />
          </LazyRoute>
        )}
      </AppRoute>

      <AdminRoute path="/admin/settings" requirePermission title={t("settings.title")} description={t("admin.settings_description")}>
        <LazyRoute><Settings /></LazyRoute>
      </AdminRoute>

      <AdminRoute path="/admin/health" requirePermission title={t("health.title")} description={t("admin.health_description")}>
        <LazyRoute><HealthPage /></LazyRoute>
      </AdminRoute>

      <AdminRoute path="/admin/queue-status" requirePermission title={t("queue_status.title")} description={t("admin.queue_status_description")}>
        <LazyRoute><QueueStatusPage /></LazyRoute>
      </AdminRoute>

      <AdminRoute path="/admin/compat-tasks" requirePermission title={t("compat_tasks.title")} description={t("admin.compat_tasks_description")}>
        <LazyRoute><CompatTasksPage /></LazyRoute>
      </AdminRoute>

      <AdminRoute path="/admin/writing" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        <LazyRoute><WritingPage /></LazyRoute>
      </AdminRoute>

      <AdminRoute path="/admin/writing/:id" requirePermission title={t("writing")} description={t("admin.writing_description")}>
        {({ id }) => (
          <LazyRoute>
            <WritingPage id={tryInt(0, id)} />
          </LazyRoute>
        )}
      </AdminRoute>

      <AppRoute path="/callback">
        <LazyRoute><CallbackPage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/login">
        <LazyRoute><LoginPage /></LazyRoute>
      </AppRoute>

      <AppRoute path="/profile">
        <LazyRoute><ProfilePage /></LazyRoute>
      </AppRoute>

      <TocRoute path="/feed/:id">
        {(params, toc, cleanup) => (
          <LazyRoute>
            <FeedPage id={params.id || ""} TOC={toc} clean={cleanup} />
          </LazyRoute>
        )}
      </TocRoute>

      <TocRoute path="/:alias">
        {(params, toc, cleanup) => (
          <LazyRoute>
            <FeedPage id={params.alias || ""} TOC={toc} clean={cleanup} />
          </LazyRoute>
        )}
      </TocRoute>

      <AppRoute path="/user/github">
        <TipsPage>
          <Tips value={t("error.api_url")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/*/user/github">
        <TipsPage>
          <Tips value={t("error.api_url_slash")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute path="/user/github/callback">
        <TipsPage>
          <Tips value={t("error.github_callback")} type="error" />
        </TipsPage>
      </AppRoute>

      <AppRoute>
        <LazyRoute>
          <ErrorPage error={t("error.not_found")} />
        </LazyRoute>
      </AppRoute>
    </Switch>
  );
}

function AppRoute({
  path,
  children,
  headerComponent,
  paddingClassName,
  requirePermission,
}: {
  path?: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  headerComponent?: ReactNode;
  paddingClassName?: string;
  requirePermission?: boolean;
}) {
  const profile = useContext(ProfileContext);
  const siteConfig = useSiteConfig();
  const { t } = useTranslation();

  const content =
    requirePermission && !profile?.permission ? (
      <LazyRoute>
        <ErrorPage error={t("error.permission_denied")} />
      </LazyRoute>
    ) : (
      children
    );

  return (
    <Route path={path}>
      {(params) => {
        const resolvedContent = typeof content === "function" ? content(params) : content;
        const layoutDefinition = getHeaderLayoutDefinition(siteConfig.headerLayout);

        return layoutDefinition.renderRouteShell({
          header: <Header>{headerComponent}</Header>,
          content: <Padding className={paddingClassName}>{resolvedContent}</Padding>,
          footer: <Footer />,
          paddingClassName,
        });
      }}
    </Route>
  );
}

function AdminRoute({
  path,
  children,
  requirePermission,
  title,
  description,
}: {
  path: PathPattern;
  children: ReactNode | ((params: DefaultParams) => ReactNode);
  requirePermission?: boolean;
  title: string;
  description: string;
}) {
  const profile = useContext(ProfileContext);
  const { t } = useTranslation();
  const content =
    requirePermission && !profile?.permission ? (
      <LazyRoute>
        <ErrorPage error={t("error.permission_denied")} />
      </LazyRoute>
    ) : (
      children
    );

  return (
    <Route path={path}>
      {(params) => (
        <AdminLayout title={title} description={description}>
          {typeof content === "function" ? content(params) : content}
        </AdminLayout>
      )}
    </Route>
  );
}

function TocRoute({
  path,
  children,
}: {
  path: PathPattern;
  children: (params: DefaultParams, toc: () => JSX.Element, cleanup: (id: string) => void) => ReactNode;
}) {
  const { TOC, cleanup } = useTableOfContents(".toc-content");

  return (
    <AppRoute path={path} headerComponent={<FeedTocHeader TOC={TOC} />} paddingClassName="mx-4">
      {(params) => children(params, TOC, cleanup)}
    </AppRoute>
  );
}
