# Move By: self-updating

A static site that rebuilds itself every day from the City of Boston's
[Street Sweeping Schedules](https://data.boston.gov/dataset/street-sweeping-schedules) table.

## How the updates work

1. **Every day** (about 4 AM Boston time) a GitHub Actions job runs `build.mjs`.
2. It downloads the City's table through the open-data API, turns each row into a sign rule using the
   same code the app uses, and writes `dist/index.html` (the app, data embedded) and `dist/schedule.json`.
3. It refuses to publish if the data looks wrong (too few rules, columns changed). A failed run leaves
   the previous site online.
4. The published page re-fetches `schedule.json` when opened, every 6 hours while open, and when you
   return to the tab, so nobody has to reload to get the latest.
5. If the City changes the schedule for a block where someone has a car saved, the app tells them.

## No hosting? Update by hand

The app also has an **Update the schedule from a CSV** section at the bottom. Download the CSV from the
City's page, choose it there, and the app checks it, switches to it, and remembers it in that browser.
It refuses files that look incomplete or older than what's already loaded.

## Set it up for automatic updates (about 5 minutes)

1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. In the repository go to **Settings, Pages** and set **Source** to **GitHub Actions**.
3. Go to the **Actions** tab, choose **Update street sweeping data**, and click **Run workflow**.
4. When it finishes, your site is at `https://<your-username>.github.io/<repository-name>/`.

## Run it yourself

    node build.mjs                      # latest data from data.boston.gov into ./dist
    node build.mjs --csv schedule.csv   # or from a CSV you downloaded

Needs Node 18 or newer and nothing else.

## Good to know

- GitHub pauses scheduled workflows in repositories with no activity for 60 days. If the badge in the
  app footer starts saying the copy is old, open the Actions tab and re-enable the workflow.
- The workflow's action versions (`checkout@v4` etc.) may eventually be retired. GitHub will say so in the
  run log; just bump the version number.
- The app does not track City holiday suspensions of daytime sweeping, because the table doesn't include them.
