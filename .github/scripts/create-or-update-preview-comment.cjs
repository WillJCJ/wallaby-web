module.exports = async ({ github, context, core }) => {
  const marker = '<!-- wallaby-preview-url -->';
  const previewUrl = process.env.PREVIEW_URL;
  const shortSha = process.env.SHORT_SHA;
  const commitTime = process.env.COMMIT_TIME;

  const body = [
    marker,
    '## Preview deployment',
    '',
    `- Preview URL: ${previewUrl}`,
    `- Commit: ${shortSha} - ${commitTime} (UTC)`,
  ].join('\n');

  const { owner, repo } = context.repo;
  const issue_number = context.issue.number;

  try {
    const { data: comments } = await github.rest.issues.listComments({
      owner,
      repo,
      issue_number,
      per_page: 100,
    });

    const existing = comments.find(
      (comment) => comment.user?.type === 'Bot' && comment.body?.includes(marker)
    );

    if (existing) {
      await github.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body,
      });
    } else {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body,
      });
    }
  } catch (error) {
    if (error.status === 403) {
      core.warning(
        'Skipping PR preview comment because GITHUB_TOKEN cannot write issue comments in this repository configuration.'
      );
      return;
    }

    throw error;
  }
};
