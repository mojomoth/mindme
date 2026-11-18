import { notFound } from 'next/navigation';
import { SCREENS, type ScreenId } from '../mock';
import { ScreensDemo } from '../ScreensDemo';

export const dynamicParams = false;

export function generateStaticParams() {
  return SCREENS.map((s) => ({ screen: s.id }));
}

export default async function ScreenPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!SCREENS.some((s) => s.id === screen)) notFound();
  return <ScreensDemo screen={screen as ScreenId} />;
}
