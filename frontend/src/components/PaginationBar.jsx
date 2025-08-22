import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    PaginationEllipsis,
} from "@/components/ui/pagination";

function getPages(curr, total) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (curr <= 3) return [1, 2, 3, 4, "…", total];
    if (curr >= total - 2) return [1, "…", total - 3, total - 2, total - 1, total];
    return [1, "…", curr - 1, curr, curr + 1, "…", total];
}

export function PaginationBar({ page, pageCount, onPageChange }) {
    if (pageCount <= 1) return null;

    const pages = getPages(page, pageCount);

    return (
        <Pagination className="mt-4">
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        onClick={() => onPageChange(page - 1)}
                        aria-disabled={page <= 1}
                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>

                {pages.map((p, idx) =>
                    p === "…" ? (
                        <PaginationItem key={`e-${idx}`}>
                            <PaginationEllipsis />
                        </PaginationItem>
                    ) : (
                        <PaginationItem key={p}>
                            <PaginationLink
                                isActive={p === page}
                                onClick={() => onPageChange(p)}
                            >
                                {p}
                            </PaginationLink>
                        </PaginationItem>
                    )
                )}

                <PaginationItem>
                    <PaginationNext
                        onClick={() => onPageChange(page + 1)}
                        aria-disabled={page >= pageCount}
                        className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    );
}
