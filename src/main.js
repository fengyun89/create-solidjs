import { program } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import https from "https";
import AdmZip from "adm-zip";

import cases from "./cases.js";

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
      choices: cases.map((c) => ({
        name: c.name,
        value: c.value,
        disabled: c.disabled,
      })),
    },
  ])
  .then((answers) => {
    res.case = answers.case;
    res.repo = cases.find((c) => c.value === res.case).repo;
  });

const spinner = ora("Loading template").start();
fs.mkdirSync(res.name);

const fileWrite = fs.createWriteStream(`${res.name}/main.zip`);
fileWrite.on("finish", () => {
  fileWrite.close();

  const zip = new AdmZip(`./${res.name}/main.zip`);

  zip.extractAllTo(`./${res.name}`, true);

  fs.cpSync(`${res.name}/${res.repo}-main`, `${res.name}`, {
    recursive: true,
  });

  fs.rmSync(`${res.name}/main.zip`);
  fs.rmSync(`${res.name}/${res.repo}-main`, { recursive: true });
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

  const userAgent = process.env.npm_config_user_agent ?? "";
  res.npm = /pnpm/.test(userAgent)
    ? "pnpm"
    : /yarn/.test(userAgent)
    ? "yarn"
    : "npm";

  console.log(chalk.green("\nDone. Now run:\n"));
  console.log(chalk.green(`  cd ${res.name}`));
  console.log(chalk.green(`  ${res.npm} install`));
  console.log(chalk.green(`  ${res.npm} run dev\n`));
});

https.get(
  `https://codeload.github.com/coding-freedom/${res.repo}/zip/refs/heads/main`,
  (response) => {
    if (response.statusCode !== 200) {
      spinner.fail();
      console.log(chalk.red(`Error: ${response.statusCode}`));
      process.exit(1);
    }
    response.pipe(fileWrite);
  }
);
