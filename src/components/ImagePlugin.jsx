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

    // Register mutation listener to track deletions
    // We use a Map to keep track of NodeKey -> URL mapping because once a node is 
    // destroyed, we can't access its properties anymore.
    const nodeUrlMap = new Map();

    const unregisterMutation = editor.registerMutationListener(ImageNode, (mutations) => {
      for (const [nodeKey, mutation] of mutations) {
        if (mutation === 'created' || mutation === 'updated') {
          editor.getEditorState().read(() => {
            const node = editor.getElementByKey(nodeKey); // This is the DOM element
            // Better: get the Lexical node
            const lexicalNode = editor._editorState._nodeMap.get(nodeKey);
            if (lexicalNode && lexicalNode.__src) {
              nodeUrlMap.set(nodeKey, lexicalNode.__src);
            }
          });
        } else if (mutation === 'destroyed') {
          const url = nodeUrlMap.get(nodeKey);
          if (url && url.startsWith('/notes/note-')) {
            console.log('🧹 Image node destroyed, deleting file:', url);
            fetch('/api/delete-note', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            }).catch(err => console.error('Failed to delete note file:', err));
          }
          nodeUrlMap.delete(nodeKey);
        }
      }
    });

    const unregisterCommand = editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload);
        $insertNodes([imageNode]);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );

    return () => {
      unregisterMutation();
      unregisterCommand();
    };
  }, [editor]);

  const onAddImage = (username) => {
    const src = prompt('Enter the URL of the image:');
    if (src) {
      const variant = username === "King Jeremiah" ? "gold" : username === "Queen Lauren" ? "purple" : "gold";
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src,
        altText: 'Crousia Image',
        variant,
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
        const variant = username === "King Jeremiah" ? "gold" : username === "Queen Lauren" ? "purple" : "gold";
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src: data.url,
          altText: data.altText || 'Handwritten Note',
          variant,
        });
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
    }
    // Reset input using ref instead of e.target which might be nullified
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="toolbar">
      <button onClick={() => onAddImage(username)} className="toolbar-item">
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
