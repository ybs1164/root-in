import { describe, expect, it } from 'vitest';
import { edgeLookKey, pingLookKey, type Group, type GroupMember, type GroupPing } from '../domain/groups';
import { buildGroupLines, buildGroupMarks } from './groupMarks';

const ping = (hour: number, center: [number, number], more: Partial<GroupPing> = {}): GroupPing => ({
  at: `2026-11-16T0${hour}:00:00.000Z`,
  center,
  ...more,
});

const member = (userId: string, color: number, pings: GroupPing[], more: Partial<GroupMember> = {}): GroupMember => ({
  userId,
  slot: color,
  color,
  nickname: userId,
  alias: null,
  photo: null,
  pings,
  ...more,
});

const group = (members: GroupMember[]): Group => ({ id: 'g', name: 'g', cover: 0, inviteSlug: 'abcdefgh', mine: true, members });

const noLooks = () => undefined;

// Far apart: nobody shares a place.
const apart = () =>
  group([
    member('a', 0, [ping(1, [126.9, 37.5], { name: '광화문' }), ping(2, [127.0, 37.6], { name: '서촌 카페', photo: 'p/a2.jpg' })], { photo: 'a.jpg' }),
    member('b', 1, [ping(3, [127.3, 37.2], { name: '통인시장' })]),
  ]);

describe('buildGroupMarks', () => {
  it("marks every ping, each member's latest as their face", () => {
    const marks = buildGroupMarks(apart(), null, null, noLooks);
    expect(marks.map((m) => `${m.member}:${m.seq}`)).toEqual(['a:0', 'a:1', 'b:0']);
    expect(marks.map((m) => !!m.face)).toEqual([false, true, true]);
    expect(marks[1].face).toEqual({ photo: 'a.jpg' });
    expect(marks[1].photos).toEqual(['p/a2.jpg']);
    expect(marks[0].photos).toBeUndefined();
  });

  it('writes no names and fades nobody while ALL', () => {
    const marks = buildGroupMarks(apart(), null, null, noLooks);
    expect(marks.every((m) => m.label === undefined && !m.faded)).toBe(true);
  });

  it("names the picked member's places and fades the others", () => {
    const marks = buildGroupMarks(apart(), 'a', null, noLooks);
    expect(marks.map((m) => m.label)).toEqual(['광화문', '서촌 카페', undefined]);
    expect(marks.map((m) => !!m.faded)).toEqual([false, false, true]);
  });

  it('marks the tapped ping, and the photo tapped on its stack', () => {
    const marks = buildGroupMarks(apart(), 'a', { member: 'a', seq: 1, photo: 0 }, noLooks);
    expect(marks.map((m) => !!m.selected)).toEqual([false, true, false]);
    expect(marks[1].selectedPhoto).toBe(0);
  });

  it("draws a ping in the shape its member gave it, never their latest (their face)", () => {
    const g = apart();
    const [first, last] = g.members[0].pings;
    const looks = { pings: { [pingLookKey(first)]: 'star' as const, [pingLookKey(last)]: 'heart' as const }, edges: {} };
    const marks = buildGroupMarks(g, null, null, (m) => (m.userId === 'a' ? looks : undefined));
    expect(marks[0].shape).toBe('star');
    expect(marks[1].shape).toBeUndefined();
  });

  it('draws a place two members pinged as one ping, the others as points under it', () => {
    const here: [number, number] = [126.9, 37.5];
    const g = group([
      member('a', 0, [ping(1, here, { name: '카페', photo: 'p/a.jpg' })]),
      member('b', 1, [ping(2, [126.90001, 37.50001], { name: '카페', photo: 'p/b.jpg' })]),
    ]);
    const marks = buildGroupMarks(g, null, { member: 'b', seq: 0 }, noLooks);
    expect(marks).toHaveLength(2);
    const [place, under] = marks;
    expect(place.together).toBe(true);
    expect(place.center).toEqual(here);
    // Both are there now (it's each one's latest ping): two faces, in their own colours.
    expect(place.faces?.map((f) => f.member)).toEqual(['a', 'b']);
    // Everyone's photos, in the order they were taken; each knows whose it is.
    expect(place.photos).toEqual(['p/a.jpg', 'p/b.jpg']);
    expect(place.photoOf).toEqual([{ member: 'a', seq: 0, photo: 0 }, { member: 'b', seq: 0, photo: 0 }]);
    // b's ping was tapped: the place is selected, on b's photo.
    expect(place.selected).toBe(true);
    expect(place.selectedPhoto).toBe(1);
    expect(under).toMatchObject({ member: 'b', seq: 0, ghost: true, center: here });
  });

  it('fades a shared place only when the picked member is not in it', () => {
    const here: [number, number] = [126.9, 37.5];
    const g = group([
      member('a', 0, [ping(1, here, { name: '카페' })]),
      member('b', 1, [ping(2, here, { name: '카페' })]),
      member('c', 2, [ping(3, [127.3, 37.2])]),
    ]);
    expect(buildGroupMarks(g, 'b', null, noLooks)[0]).toMatchObject({ faded: false, label: '카페' });
    expect(buildGroupMarks(g, 'c', null, noLooks)[0]).toMatchObject({ faded: true, label: undefined });
  });
});

describe('buildGroupLines', () => {
  it('draws a line only for members with two or more pings', () => {
    const lines = buildGroupLines(apart(), null, noLooks);
    expect(lines).toEqual([{ member: 'a', color: 'var(--member-0)', count: 2, faded: false, styles: undefined }]);
  });

  it('fades the lines of everyone but the picked member', () => {
    expect(buildGroupLines(apart(), 'b', noLooks)[0].faded).toBe(true);
    expect(buildGroupLines(apart(), 'a', noLooks)[0].faded).toBe(false);
  });

  it('gives each stretch the style its member chose', () => {
    const g = apart();
    const [from, to] = g.members[0].pings;
    const looks = { pings: {}, edges: { [edgeLookKey(from, to)]: 'dashed' as const } };
    expect(buildGroupLines(g, null, () => looks)[0].styles).toEqual(['dashed']);
  });

  it('has nothing to draw with no group open', () => {
    expect(buildGroupLines(null, null, noLooks)).toEqual([]);
  });
});
