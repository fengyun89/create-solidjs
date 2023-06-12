import { program } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import https from "https";
import AdmZip from "adm-zip";

const res = {};

program.option("-n, --name <name>", "project name");

program.arguments("[name]").action((name) => {
  res.name = name;
});

program.parse();

const options = program.opts();

res.name = res.name || options.name;

const isValidName = (name) => {
  if (typeof name !== "string") return false;
  name = name.trim();
  return name.length > 0;
};

if (!isValidName(res.name)) {
  await inquirer
    .prompt([
      {
        type: "input",
        name: "name",
        default: "solid-project",
        message: "Project name",
        validate: function (input) {
          if (!isValidName(input)) {
            return "Please enter a project name";
          }
          return true;
        },
      },
    ])
    .then((answers) => {
      res.name = answers.name;
    });
}

const files = fs.readdirSync(process.cwd());
if (files.includes(res.name)) {
  await inquirer
    .prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: `Target directory "${res.name}" is not empty. Remove existing files and continue?`,
        default: false,
      },
    ])
    .then((answers) => {
      if (answers.overwrite) {
        fs.rmSync(res.name, { recursive: true });
      } else {
        process.exit(1);
      }
    });
}

await inquirer
  .prompt([
    {
      type: "list",
      name: "case",
      default: "csr",
      message: "Select your use case",
      choices: [
        { name: "Client-side rendering (CSR)", value: "csr" },
        { name: "Server-side rendering (SSR)", value: "ssr", disabled: true },
        { name: "Streaming SSR", value: "sssr", disabled: true },
        { name: "Static site generation (SSG)", value: "ssg", disabled: true },
      ],
    },
  ])
  .then((answers) => {
    res.case = answers.case;
  });

const spinner = ora("Loading template\n").start();
fs.mkdirSync(res.name);

const fileWrite = fs.createWriteStream(`${res.name}/main.zip`);
fileWrite.on("finish", () => {
  fileWrite.close();

  const zip = new AdmZip(`./${res.name}/main.zip`);

  zip.extractAllTo(`./${res.name}`, true);

  fs.cpSync(`${res.name}/solid-csr-template-main`, `${res.name}`, {
    recursive: true,
  });

  fs.rmSync(`${res.name}/main.zip`);
  fs.rmSync(`${res.name}/solid-csr-template-main`, { recursive: true });
  fs.rmSync(`${res.name}/pnpm-lock.yaml`);

  const packageJson = JSON.parse(
    fs.readFileSync(`${res.name}/package.json`, "utf-8")
  );
  packageJson.name = res.name;
  fs.writeFileSync(
    `${res.name}/package.json`,
    JSON.stringify(packageJson, null, 2)
  );

  spinner.succeed();

  res.npm = "npm";
  if (process.env.npm_execpath) {
    if (process.env.npm_execpath.indexOf("pnpm") !== -1) {
      res.npm = "pnpm";
    } else if (process.env.npm_execpath.indexOf("yarn") !== -1) {
      res.npm = "yarn";
    }
  }

  console.log(chalk.green("\n"));
  console.log(chalk.green("Done. Now run:\n"));
  console.log(chalk.green(`  cd ${res.name}`));
  console.log(chalk.green(`  ${res.npm} install`));
  console.log(chalk.green(`  ${res.npm} run dev\n`));
});

https.get(
  "https://codeload.github.com/coding-freedom/solid-csr-template/zip/refs/heads/main",
  (response) => {
    if (response.statusCode !== 200) {
      spinner.fail();
      console.log(chalk.red(`Error: ${response.statusCode}`));
      process.exit(1);
    }
    response.pipe(fileWrite);
  }
);
