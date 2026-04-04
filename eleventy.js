import CleanCSS from 'clean-css';
import { minify } from 'html-minifier';

export default function (eleventyConfig) {
  eleventyConfig.setTemplateFormats([
    'html',
    'liquid'
  ]);
  eleventyConfig.addPassthroughCopy('images/**');
  eleventyConfig.addPassthroughCopy('site/**/scripts/**');
  eleventyConfig.addPassthroughCopy('site/**/styles/**');

  eleventyConfig.addTransform('htmlMinify', function (content, outputPath) {
    if (!outputPath.endsWith('.html')) {
      return content;
    }
    const minified = minify(content, {
      useShortDoctype: true,
      removeComments: true,
      collapseWhitespace: true,
      minifyJS: true,
      minifyCSS: true,
    });
    return minified;
  });

  eleventyConfig.addExtension('css', {
    outputFileExtension: 'css',
    compile: async (content) => {
      const result = new CleanCSS({}).minify(content)
      if (result.errors.length > 0 || result.warnings.length > 0) {
        throw new Error(
          `CleanCSS errors/warnings on file :\n\n${[
            ...result.errors,
            ...result.warnings,
          ].join('\n')}`
        );
      }
      return async () => {
        return result.styles;
      };
    }
  });
};
