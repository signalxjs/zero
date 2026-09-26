import { component, signal } from 'sigx';
import { Button, FileUpload } from '@sigx/zero';
import type { FileRejection } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

/** What a rejection code means to a person. */
const REASONS: Record<string, string> = {
    'invalid-type': 'not a text or image file',
    'too-large': 'larger than 1 MB',
    'too-small': 'empty',
    'too-many': 'over the three-file limit',
    'draft-name': 'drafts are not accepted',
};

const fileId = (f: File): string => `${f.name}${f.size}${f.lastModified}`;

const FileUploadDemos = component(() => {
    const state = signal({ rejected: [] as FileRejection[], submitted: '' });
    // Seeded, so the clear trigger (which renders only with files) shows.
    const seed = [
        new File(['# Notes\n'], 'notes.md', { type: 'text/markdown' }),
        new File(['a,b\n1,2\n'], 'data.csv', { type: 'text/csv' }),
    ];

    return () => (
    <>
        <p>
            A real <code>&lt;input type="file"&gt;</code> is the control — it
            posts its FileList natively. The trigger button is the one
            keyboard path to the picker; the dropzone is a pointer affordance
            only (drag-and-drop has no keyboard path), and a hovering drag
            raises the shared <code>data-highlighted</code> flag.
        </p>
        <FileUpload.Root name="attachments" multiple color={pickRole('primary')}>
            <FileUpload.Label>Attachments</FileUpload.Label>
            <FileUpload.Dropzone>Drop files here, or use the button</FileUpload.Dropzone>
            <FileUpload.Trigger>Browse files…</FileUpload.Trigger>
            <FileUpload.ClearTrigger label="Clear all files">Clear all</FileUpload.ClearTrigger>
            <FileUpload.ItemGroup>
                {(files: File[]) => files.map((f) => (
                    <FileUpload.Item file={f} key={`${f.name}${f.size}${f.lastModified}`}>
                        <FileUpload.ItemName />
                        <FileUpload.ItemSize />
                        <FileUpload.ItemRemove><span aria-hidden="true">✕</span></FileUpload.ItemRemove>
                    </FileUpload.Item>
                ))}
            </FileUpload.ItemGroup>
        </FileUpload.Root>
        <p>
            Single-file with an <code>accept</code> filter — a new selection
            replaces the old, and drops the picker would refuse are refused
            here too:
        </p>
        <FileUpload.Root accept="image/*">
            <FileUpload.Label>Avatar image</FileUpload.Label>
            <FileUpload.Dropzone>Drop an image</FileUpload.Dropzone>
            <FileUpload.Trigger>Choose image…</FileUpload.Trigger>
            <FileUpload.ItemGroup>
                {(files: File[]) => files.map((f) => (
                    <FileUpload.Item file={f} key={`${f.name}${f.size}${f.lastModified}`}>
                        <FileUpload.ItemName />
                        <FileUpload.ItemSize />
                        <FileUpload.ItemRemove><span aria-hidden="true">✕</span></FileUpload.ItemRemove>
                    </FileUpload.Item>
                ))}
            </FileUpload.ItemGroup>
        </FileUpload.Root>
        <p>
            Constraints: at most three text or image files of 1 MB or less,
            none empty, and no <code>draft-*</code> names (an app{' '}
            <code>validate</code>). Refused files never join the model — the{' '}
            <code>filesReject</code> event reports each with its codes, and
            the app renders them through <code>Item invalid</code>. Removing
            a file hands focus to the next remove button; clearing hands it
            to the trigger.
        </p>
        <FileUpload.Root
            name="constrained"
            multiple
            accept="text/*,.md,.csv,image/*"
            maxFiles={3}
            minFileSize={1}
            maxFileSize={1_000_000}
            validate={(f: File) => (f.name.startsWith('draft-') ? 'draft-name' : null)}
            defaultFiles={seed}
            onFilesReject={(r: FileRejection[]) => { state.rejected = r; }}
            onFilesChange={() => { state.rejected = []; }}
        >
            <FileUpload.Label>Supporting documents</FileUpload.Label>
            <FileUpload.Dropzone>Drop up to three files <small>(1 MB each)</small></FileUpload.Dropzone>
            <FileUpload.Trigger>Add files…</FileUpload.Trigger>
            <FileUpload.ClearTrigger>Clear</FileUpload.ClearTrigger>
            <FileUpload.ItemGroup>
                {(files: File[]) => files.map((f) => (
                    <FileUpload.Item file={f} key={fileId(f)}>
                        <FileUpload.ItemName />
                        <FileUpload.ItemSize />
                        <FileUpload.ItemRemove><span aria-hidden="true">✕</span></FileUpload.ItemRemove>
                    </FileUpload.Item>
                ))}
            </FileUpload.ItemGroup>
            {state.rejected.length > 0
                ? (
                    <FileUpload.ItemGroup aria-label="Refused files">
                        {state.rejected.map((r) => (
                            <FileUpload.Item file={r.file} invalid key={fileId(r.file)}>
                                <FileUpload.ItemName />
                                <small>{r.errors.map((code) => REASONS[code] ?? code).join(', ')}</small>
                            </FileUpload.Item>
                        ))}
                    </FileUpload.ItemGroup>
                )
                : null}
        </FileUpload.Root>
        <p>
            Required, inside a form: submitting with no file cancels the
            platform's bubble (it would point at a 1px input), focuses the
            trigger and marks the field invalid until a file is chosen.
        </p>
        <form
            aria-label="Required upload"
            onSubmit={(e: Event) => {
                e.preventDefault();
                state.submitted = 'Submitted.';
            }}
        >
            <FileUpload.Root name="resume" required accept=".pdf,.txt">
                <FileUpload.Label>Résumé</FileUpload.Label>
                <FileUpload.Trigger>Choose file…</FileUpload.Trigger>
                <FileUpload.ItemGroup>
                    {(files: File[]) => files.map((f) => (
                        <FileUpload.Item file={f} key={fileId(f)}>
                            <FileUpload.ItemName />
                            <FileUpload.ItemRemove><span aria-hidden="true">✕</span></FileUpload.ItemRemove>
                        </FileUpload.Item>
                    ))}
                </FileUpload.ItemGroup>
            </FileUpload.Root>
            <Button.Root type="submit">Submit</Button.Root>
            <output>{state.submitted}</output>
        </form>
        <p>Disabled:</p>
        <FileUpload.Root disabled>
            <FileUpload.Label>Locked</FileUpload.Label>
            <FileUpload.Dropzone>Uploads are disabled</FileUpload.Dropzone>
            <FileUpload.Trigger>Browse files…</FileUpload.Trigger>
        </FileUpload.Root>
    </>
    );
}, { name: 'FileUploadDemos' });

export const fileUploadPage: PageEntry = {
    id: 'file-upload',
    title: 'FileUpload',
    category: 'Forms & inputs',
    Demos: FileUploadDemos,
};
