import { useEffect, useMemo, useState } from "react";
import { asArray } from "@/lib/asArray";

export function usePagination(items, pageSize = 5) {
    const arr = asArray(items);
    const [page, setPage] = useState(1);

    const pageCount = Math.max(1, Math.ceil(arr.length / pageSize));
    const current = Math.min(page, pageCount);
    const offset = (current - 1) * pageSize;

    const pageItems = useMemo(
        () => arr.slice(offset, offset + pageSize),
        [arr, offset, pageSize]
    );

    // Reset till sida 1 när datan ändras
    useEffect(() => {
        setPage(1);
    }, [arr.length, pageSize]);

    const setSafePage = (p) => setPage(Math.min(Math.max(1, p), pageCount));

    return { page: current, setPage: setSafePage, pageCount, pageItems, total: arr.length, pageSize };
}
