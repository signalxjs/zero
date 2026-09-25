import { component, signal } from 'sigx';
import { Field, Progress, Slider } from '@sigx/zero';
import type { PageEntry } from './registry';

const SliderDemos = component(() => {
    const state = signal({ volume: 40, price: [120, 350], level: 30, gain: 60 });

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
            <h2>Vertical</h2>
            <p>
                <code>orientation="vertical"</code> runs the rail bottom-to-top,
                on both projections: the composed track and the native control.
            </p>
            <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
                <Slider.Root model={() => state.level} orientation="vertical" marks={[0, { value: 50, label: '50' }, 100]}>
                    <Slider.Label>Level</Slider.Label>
                    <Slider.Track>
                        <Slider.Range />
                        <Slider.Thumb label="Level" />
                    </Slider.Track>
                    <Slider.ValueText />
                </Slider.Root>
                <Slider.Root model={() => state.gain} orientation="vertical">
                    <Slider.Label>Gain</Slider.Label>
                    <Slider.Control />
                    <Slider.ValueText />
                </Slider.Root>
            </div>
            <p>
                Inside a <code>Field</code> the native control and every thumb
                take the field's <code>aria-describedby</code>, and{' '}
                <code>getValueText</code> speaks for the native control as it
                does for a thumb.
            </p>
            <Field.Root data-demo="slider-field">
                <Field.Label>Brightness</Field.Label>
                <Slider.Root defaultValue={70} getValueText={(v) => `${v} percent`}>
                    <Slider.Control />
                    <Slider.ValueText />
                </Slider.Root>
                <Field.Description>Applies to every display.</Field.Description>
            </Field.Root>
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
