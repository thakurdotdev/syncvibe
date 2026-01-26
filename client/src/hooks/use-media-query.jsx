"use client";

import { useEffect, useState } from "react";

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    const media = window.matchMedia(query);

    if (media.matches !== matches) setMatches(media.matches);

    const listener = () => setMatches(media.matches);

    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [query, matches]);

  return matches;
};

export default useMediaQuery;
