import { BOOK_GENRE_BY_SLUG } from "@/lib/book-genre-by-slug";

/** Short genre hint for search “Did you mean” chips (e.g. Romans · NT Epistle). */
export function getBookGenreHint(bookSlug: string | undefined): string | null {
  if (!bookSlug) return null;
  const genre = BOOK_GENRE_BY_SLUG[bookSlug];
  if (!genre) return null;
  if (genre === "Epistles" || genre === "General Epistles") return "NT Epistle";
  if (genre === "Gospels") return "Gospel";
  return genre;
}

export function formatBookSuggestionChipLabel(
  bookName: string,
  bookSlug: string | undefined,
): string {
  const hint = getBookGenreHint(bookSlug);
  return hint ? `${bookName} · ${hint}` : bookName;
}
