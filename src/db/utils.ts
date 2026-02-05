export const takeFirst = <T>(xs: T[]) => {
  return xs[0];
};

export const takeFirstOrThrow = <T>(xs: T[]) => {
  const ret = xs[0];
  if (ret === undefined) throw new Error("Empty array");
  return ret;
};
