const fs = require('fs');
const { execSync } = require('child_process');

const VERSION_FILE = 'build-version.json';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

try {
  // Ensure working tree is clean
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    console.error('❌ Working tree is not clean. Commit your changes first.');
    process.exit(1);
  }

  // Read + bump version
  const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  data.build += 1;

  fs.writeFileSync(
    VERSION_FILE,
    JSON.stringify(data, null, 2) + '\n'
  );

  // Commit version bump
  run(`git add ${VERSION_FILE}`);
  run(`git commit -m "chore: bump build to ${data.build}"`);

  // Push everything
  run('git push');

  console.log(`✅ Pushed build ${data.build}`);
} catch (err) {
  console.error('❌ Push failed');
  process.exit(1);
}
