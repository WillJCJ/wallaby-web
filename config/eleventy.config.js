import CleanCSS from 'clean-css';
import { minify } from 'html-minifier-next';
import process from 'node:process';

/**
 * Configure Eleventy with plugins, filters, and transforms.
 * @param {object} eleventyConfig - The Eleventy configuration object
 * @returns {void}
 */
export default function (eleventyConfig) {
  const runMinify = process.env.MINIFY !== 'false';

  eleventyConfig.addFilter('slugify', function (value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  });

  eleventyConfig.setTemplateFormats([
    'md',
    'html',
    'liquid'
  ]);
  eleventyConfig.addPassthroughCopy('images/**');
  eleventyConfig.addPassthroughCopy('site/styles/**/*.css');
  eleventyConfig.addPassthroughCopy('site/scripts/**/*.js');
  eleventyConfig.addPassthroughCopy('site/site.webmanifest');
  eleventyConfig.addPassthroughCopy('site/sw.js');
  eleventyConfig.addPassthroughCopy({ 'config/_headers': '_headers' });

  eleventyConfig.addFilter('age', function (dobString) {
    if (!dobString || dobString === 'TBC') {return 'TBC';}
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    // If less than 1 year old, show age in months
    if (age < 1) {
      const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
      return `${months} month${months !== 1 ? 's' : ''}`;
    }

    return `${age} year${age !== 1 ? 's' : ''}`;
  });

  eleventyConfig.addTransform('htmlMinify', function (content, outputPath) {
    if (!outputPath.endsWith('.html') || !runMinify) {
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
      if (!runMinify) {
        return async () => {
          return content;
        };
      }
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