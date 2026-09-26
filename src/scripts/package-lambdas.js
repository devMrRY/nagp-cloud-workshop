const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = process.cwd();

const lambdas = [
  {
    name: "add-doc-metadata",
    usesDb: true,
  },
  {
    name: "view-doc-metadata",
    usesDb: true,
  },
  {
    name: "trigger-asg-deployment",
    usesDb: false,
  },
];

const buildDir = path.join(root, "lambda-build");

fs.rmSync(buildDir, {
  recursive: true,
  force: true,
});

fs.mkdirSync(buildDir, {
  recursive: true,
});

for (const lambda of lambdas) {
  console.log(`Packaging ${lambda.name}...`);

  const lambdaDir = path.join(buildDir, lambda.name);

  fs.mkdirSync(lambdaDir, {
    recursive: true,
  });

  // Copy Lambda handler
  fs.copyFileSync(
    path.join(root, "src", "lambda", lambda.name, "index.mjs"),
    path.join(lambdaDir, "index.mjs")
  );

  // Copy shared DB code
  if (lambda.usesDb) {
    fs.cpSync(
      path.join(root, "src", "db"),
      path.join(lambdaDir, "db"),
      {
        recursive: true,
      }
    );
  }

  const zipPath = path.join(root, `${lambda.name}.zip`);

  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath);
  }

  execSync(
    `powershell -Command "Compress-Archive -Path '${lambdaDir}\\*' -DestinationPath '${zipPath}'"`,
    {
      stdio: "inherit",
    }
  );

  console.log(`Created ${lambda.name}.zip`);
}

console.log("Lambda packaging completed.");