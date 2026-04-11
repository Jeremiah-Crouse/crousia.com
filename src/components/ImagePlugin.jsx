import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useEffect, useRef } from 'react';
import { $createImageNode, ImageNode } from './ImageNode';

export const INSERT_IMAGE_COMMAND = createCommand();

export default function ImagePlugin({ isAdmin, username }) {
  const [editor] = useLexicalComposerContext();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagePlugin: ImageNode not registered on editor');
    }

    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);

  const onAddImage = () => {
    const src = prompt('Enter the URL of the image:');
    if (src) {
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src,
        altText: 'Crousia Image',
      });
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('username', username);

    try {
      const res = await fetch('/api/upload-note', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src: data.url,
          altText: 'Handwritten Note',
        });
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
    }
    // Reset input
    e.target.value = '';
  };

  if (!isAdmin) return null;

  return (
    <div className="toolbar">
      <button onClick={onAddImage} className="toolbar-item">
        Add URL
      </button>
      <button onClick={onUploadClick} className="toolbar-item">
        Upload Note
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
    </div>
  );
}
