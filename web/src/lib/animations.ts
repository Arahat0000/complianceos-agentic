import type { Variants, Transition } from "motion/react";

// ─── Shared stagger animation variants ───────────────────────────────────────
// Use these in pages to get consistent staggered section animations.
//
// Usage:
//   <motion.div variants={pageContainer} initial="hidden" animate="show">
//     <motion.div variants={pageItem}>…</motion.div>
//   </motion.div>

const _itemTransition: Transition = {
    duration: 0.32,
    ease: [0.25, 0.1, 0.25, 1],
};

export const pageContainer: Variants = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0,
        },
    },
};

export const pageItem: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: {
        opacity: 1,
        y: 0,
        transition: _itemTransition,
    },
};
