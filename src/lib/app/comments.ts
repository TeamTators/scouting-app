export type CommentSection = {
    auto: string[];
    tele: string[];
    end: string[];
};

export const comments: {
    general: CommentSection;
    2024: CommentSection;
} = {
    general: {
        auto: ['Did not move in autonomous', 'Mobility only in auto'],
        tele: [
            '"Dead" after hard hit',
            'clever driver, adapts quickly',
            'Drove around aimlessly',
            'fast and maneuverable',
            'gets fouls hitting bots in protected zones',
            'gets in partner\'s way',
            'hits opponents very hard',
            'Mostly played defense',
            'Very slow'
        ],
        end: []
    },
    2024: {
        auto: [
            'only shot preload',
            '2 note auto',
            '3 note auto',
            '4 note auto',
            '5 note auto',
            '6 note auto'
        ],
        tele: [
            'Amp only',
            'Ate 2 notes',
            'Extremely accurate shooter',
            'Long Range Shooter',
            'Mid Range Shooter',
            'misses a lot of shots',
            'Note jammed in bot',
            'Often misses floor pick',
            'Only shoots from subwoofer',
            'Steals from opponents\' source',
            'Takes a long time to set up shot',
            'Very fast floor pick'
        ],
        end: ['Climbs quickly', 'Cannot climb', 'Slow climb']
    }
};
