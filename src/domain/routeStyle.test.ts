import { describe, expect, it } from 'vitest';
import { cleanRouteLook, withEdgeStyle, withStopShape } from './routeStyle';

describe('route look', () => {
  it('sets a stop shape and a line style per slot', () => {
    let look = withStopShape({}, 3, 1, 'star');
    look = withEdgeStyle(look, 3, 0, 'dashed');
    expect(look).toEqual({ stopShapes: [null, 'star', null], edgeStyles: ['dashed', null] });
  });

  it('back to all defaults stores nothing', () => {
    const look = withStopShape(withStopShape({}, 2, 0, 'heart'), 2, 0, null);
    expect(look).toEqual({ stopShapes: undefined, edgeStyles: undefined });
  });

  it('drops unknown values and fits the arrays to the stops', () => {
    expect(cleanRouteLook({ stopShapes: ['star', 'blob', 'dot', 'pin'] as never, edgeStyles: ['bold', 7, 'x'] as never }, 3)).toEqual({
      stopShapes: ['star', null, 'dot'],
      edgeStyles: ['bold', null],
    });
  });
});
