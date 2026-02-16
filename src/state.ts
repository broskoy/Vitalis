import { createMutable } from "solid-js/store";

export const PRESETS = {
    default: [
        [0, 1, 1, 1],
        [1, 0, 1, -1],
        [1, -1, 0, 1],
        [1, 1, -1, 0]
    ],
    worms: [
        [0.4, 0.0, 0.0, 0.0],
        [0.3, 0.2, 0.3, 0.0],
        [0.0, 0.3, 0.2, 0.3],
        [0.0, 0.0, 0.3, 0.2]
    ],
    cells: [
        [0.5, 0.2, 0.2, 0.2],
        [1.0, 0.1, -0.1, -0.1],
        [1.0, -0.1, 0.1, -0.1],
        [1.0, -0.1, -0.1, 0.1]
    ],
    fireworks: [
        [0.4, 0.4, -0.2, -0.2],
        [-0.2, 0.4, 0.4, -0.2],
        [-0.2, -0.2, 0.4, 0.4],
        [0.4, -0.2, -0.2, 0.4]
    ]
};


export const State = createMutable({
    friction: 0.8,
    forceStrength: 0.1,
    attractions: PRESETS.default
});