import { Rail } from '@/components/Rail';
import { Hero } from '@/components/Hero';
import { RoomInstrument } from '@/components/RoomInstrument';
import { Rigs } from '@/components/Rigs';
import { Delivery } from '@/components/Delivery';
import { Book } from '@/components/Book';
import { Footer } from '@/components/Footer';

export default function Page() {
  return (
    <>
      <a
        href="#room"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-sodium focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:text-ink"
      >
        Skip to sizing your room
      </a>
      <Rail />
      <main>
        <Hero />
        <RoomInstrument />
        <Rigs />
        <Delivery />
        <Book />
      </main>
      <Footer />
    </>
  );
}
