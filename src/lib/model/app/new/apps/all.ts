import build2025 from './2025';


export const build = (year: 2024 | 2025) => {
    switch (year) {
        // case 2024:
            // return build2024;
        case 2025:
            return build2025;
    }

    throw new Error('Not found');
}