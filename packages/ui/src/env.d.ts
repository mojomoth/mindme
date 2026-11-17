// Next.js 가 번들 시 처리하는 정적 에셋/CSS Module 타입 (ui 패키지 단독 typecheck 용)
declare module '*.png' {
  const image: { src: string; width: number; height: number };
  export default image;
}
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
