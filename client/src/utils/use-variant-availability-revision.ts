import { useEffect, useState } from "react";
import { onVariantAvailabilityChange } from "./variant-availability";

export function useVariantAvailabilityRevision() {
    const [revision, setRevision] = useState(0);

    useEffect(
        () =>
            onVariantAvailabilityChange(() => {
                setRevision((value) => value + 1);
            }),
        [],
    );

    return revision;
}
