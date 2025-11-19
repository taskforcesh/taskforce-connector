import { gt } from 'semver';
import { yellow } from "chalk";

/**
 * Check if the current version of taskforce is the latest version
 * @param name - package name
 * @param version - current version of taskforce
 */
export const versionChecker = async (name: string, version: string) => {

  const latestVersion = (await import('latest-version')).default;

  try {
    const newestVersion = await latestVersion(name);

    if (gt(newestVersion, version)) {
      console.error(
        yellow(
          "New version " +
          newestVersion +
          " of Taskforce Connector available, please upgrade with yarn global add @magicaltome/taskforce-connector"
        )
      );
    }
  } catch (err) {
    console.error(
      yellow(
        "Error checking for latest version of Taskforce Connector"
      ),
      err
    );
  }
};
