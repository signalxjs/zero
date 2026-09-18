import { component } from 'sigx';
import { FileUpload } from '@sigx/zero';
import { pickRole } from '../design-systems';
import type { PageEntry } from './registry';

const FileUploadDemos = component(() => () => (
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
        <p>Disabled:</p>
        <FileUpload.Root disabled>
            <FileUpload.Label>Locked</FileUpload.Label>
            <FileUpload.Dropzone>Uploads are disabled</FileUpload.Dropzone>
            <FileUpload.Trigger>Browse files…</FileUpload.Trigger>
        </FileUpload.Root>
    </>
), { name: 'FileUploadDemos' });

export const fileUploadPage: PageEntry = {
    id: 'file-upload',
    title: 'FileUpload',
    category: 'Forms & inputs',
    Demos: FileUploadDemos,
};
