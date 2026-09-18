import { component, signal } from 'sigx';
import { Progress, Slider } from '@sigx/zero';
import type { PageEntry } from './registry';

const SliderDemos = component(() => {
    const state = signal({ volume: 40, price: [120, 350] });

    return () => (
        <>
            <Slider.Root model={() => state.volume}>
                <Slider.Label>Volume</Slider.Label>
                <Slider.Control />
                <Slider.ValueText />
            </Slider.Root>

            <h2>Range</h2>
            <p>
                <code>model</code> accepts <code>number[]</code>: one{' '}
                <code>Slider.Thumb</code> per value on a composed track,
                thumbs clamp at their neighbors, and <code>marks</code>{' '}
                renders ticks.
            </p>
            <Slider.Root
                model={() => state.price}
                min={0}
                max={500}
                step={10}
                name="price"
                marks={[{ value: 0, label: '$0' }, { value: 250, label: '$250' }, { value: 500, label: '$500' }]}
                getValueText={(v, i) => `${v} dollars (${i === 0 ? 'minimum' : 'maximum'})`}
            >
                <Slider.Label>Price range</Slider.Label>
                <Slider.Track>
                    <Slider.Range />
                    <Slider.Thumb label="Minimum price" />
                    <Slider.Thumb label="Maximum price" />
                </Slider.Track>
                <Slider.ValueText />
            </Slider.Root>
            <Slider.Root defaultValue={95} invalid>
                <Slider.Label>Invalid (above the allowed budget)</Slider.Label>
                <Slider.Control />
                <Slider.ValueText />
            </Slider.Root>
            {/*
              * The mirror lives here rather than on the Progress page because
              * it is the slider's value it mirrors — the two components share
              * one signal, which only works on one page.
              */}
            <Progress.Root value={state.volume}>
                <Progress.Label>Mirrors the slider</Progress.Label>
                <Progress.Track><Progress.Range /></Progress.Track>
                <Progress.ValueText />
            </Progress.Root>
        </>
    );
}, { name: 'SliderDemos' });

export const sliderPage: PageEntry = {
    id: 'slider',
    title: 'Slider',
    category: 'Forms & inputs',
    Demos: SliderDemos,
};
