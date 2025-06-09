
export interface SearchEngine {
    c: string; // category
    d: string; // domain
    r: number; // rank or some numerical value
    s: string; // short name
    sc: string; // sub-category
    t: string; // title
    u: string; // URL template
}

export function parseSearchEngines(jsonString: string): SearchEngine[] {
    try {
        return JSON.parse(jsonString) as SearchEngine[];
    } catch (error) {
        console.error("Error parsing search engines JSON:", error);
        return [];
    }
}