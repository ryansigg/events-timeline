import { registerBlockType } from '@wordpress/blocks';

import metadata from './block.json';
import Edit from './edit';
import './style.scss';
import './editor.scss';

// Dynamic block: render.php produces the markup, so there is no save().
registerBlockType( metadata.name, {
	edit: Edit,
} );
