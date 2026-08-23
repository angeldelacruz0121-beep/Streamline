/**
 * The primitive set. Importing any primitive brings its stylesheet with it,
 * so a primitive cannot render unstyled.
 */
import './primitives.css';

export { Figure, type FigureProps } from './Figure';
export { InstrumentLabel, type InstrumentLabelProps } from './InstrumentLabel';
export { Plate, type PlateProps } from './Plate';
export { Rule, type RuleProps } from './Rule';
