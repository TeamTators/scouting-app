export const load = (event) => {
    // get year through regex
    const year = parseInt(event.params.eventKey.match(/^\d{4}/)?.[0] || '2023');

    return {
        ...event.params,
        year,
    }
};