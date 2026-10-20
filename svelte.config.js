import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter({
			fallback: undefined
		}),
		paths: {
			// GitHub Pages project sites live at /repo-name/ - set BASE_PATH in CI.
			// Leave unset (or empty) when serving from a custom domain at the root.
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
