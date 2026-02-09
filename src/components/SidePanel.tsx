'use client';

import React, { forwardRef } from 'react';
import { motion, type Transition } from 'framer-motion';

import { animation } from '@/lib/design-tokens';

export type SidePanelProps = React.PropsWithChildren<{
  isOpen: boolean;
  width: number | string;
  transition?: Transition;
  style?: React.CSSProperties;
}>;

export const SidePanel = forwardRef<HTMLElement, SidePanelProps>(
  ({ isOpen, width, transition = animation.spring.panel, style, children }, ref) => (
    <motion.aside
      ref={ref}
      initial={false}
      animate={{
        width: isOpen ? width : 0,
        opacity: isOpen ? 1 : 0,
      }}
      transition={transition}
      style={style}
    >
      {children}
    </motion.aside>
  )
);

SidePanel.displayName = 'SidePanel';
