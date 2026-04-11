import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodes, createCommand, COMMAND_PRIORITY_EDITOR } from 'lexical';
import { useEffect } from 'react';
import { $createImageNode, ImageNode } from './ImageNode';

export const INSERT_IMAGE_COMMAND = createCommand();

export default function ImagePlugin({ isAdmin }) {
  const [editor] = useLexicalComposerContext();

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

  if (!isAdmin) return null;

  return (
    <div className="toolbar">
      <button onClick={onAddImage} className="toolbar-item">
        Add Image
      </button>
    </div>
  );
}
