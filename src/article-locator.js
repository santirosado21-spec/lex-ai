// Exact directory lookup only, never free-text statutory interpretation.
export function locateDirectoryArticle(query, entries) {
 if (typeof query !== 'string' || query.length > 60) return {status:'invalid'};
 const match = /^(?:art(?:ículo|iculo|\.)?\s*)?(\d{1,3})(?:\s*[- ]\s*(bis(?:[- ]\d{1,2})?|ter|[a-z]))?\s*\.?$/iu.exec(query.trim());
 if (!match || Number(match[1]) === 0) return {status:'invalid'};
 const id = String(Number(match[1])) + (match[2] ? '-' + match[2].toUpperCase().replace(/ /g,'-') : '');
 const found = entries.find(entry => entry.article.toUpperCase() === id);
 return found ? {status:'found',article:found.article} : {status:'missing',article:id};
}
