import { component } from 'sigx';
import { Carousel } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

/** Demo slide box — sized so the snap has something real to snap. */
const slideStyle = 'display: grid; place-items: center; min-height: 10rem; font-size: 1.25rem;';

const CarouselDemos = component(() => () => (
    <>
        <p>
            A scroll-snap viewport whose model is the active index: swipe or
            scroll and the dots follow (IntersectionObserver); press a dot or
            a nav button and the item scrolls into view — smoothly, unless
            reduced motion asks for a jump. The buttons clamp at the ends; no
            wrap.
        </p>
        <Carousel.Root label="Featured places">
            <Carousel.Viewport>
                <Carousel.Item><div style={slideStyle}>First slide — mountains</div></Carousel.Item>
                <Carousel.Item><div style={slideStyle}>Second slide — coastline</div></Carousel.Item>
                <Carousel.Item><div style={slideStyle}>Third slide — forest</div></Carousel.Item>
            </Carousel.Viewport>
            <Carousel.PrevTrigger label="Previous slide">‹</Carousel.PrevTrigger>
            <Carousel.NextTrigger label="Next slide">›</Carousel.NextTrigger>
            <Carousel.IndicatorGroup>
                <Carousel.Indicator index={0} />
                <Carousel.Indicator index={1} />
                <Carousel.Indicator index={2} />
            </Carousel.IndicatorGroup>
        </Carousel.Root>
        <p>Small, with the colour axis on the active dot:</p>
        <div style="max-width: 20rem">
            <Carousel.Root label="Quotes" size="sm" color={pickRole('primary')}>
                <Carousel.Viewport>
                    <Carousel.Item><div style={slideStyle}>“Make it obvious.”</div></Carousel.Item>
                    <Carousel.Item><div style={slideStyle}>“Then make it fast.”</div></Carousel.Item>
                </Carousel.Viewport>
                <Carousel.PrevTrigger label="Previous quote">‹</Carousel.PrevTrigger>
                <Carousel.NextTrigger label="Next quote">›</Carousel.NextTrigger>
                <Carousel.IndicatorGroup>
                    <Carousel.Indicator index={0} label="Go to quote 1" />
                    <Carousel.Indicator index={1} label="Go to quote 2" />
                </Carousel.IndicatorGroup>
            </Carousel.Root>
        </div>
    </>
), { name: 'CarouselDemos' });

export const carouselPage: PageEntry = {
    id: 'carousel',
    title: 'Carousel',
    category: 'Display & feedback',
    Demos: CarouselDemos,
};
