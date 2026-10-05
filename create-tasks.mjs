// Creates tasks in tasks-api.echop.us from a list.
// Usage:
//   TOKEN=your_token node create-tasks.mjs            -> create all tasks
//   DRY_RUN=1 node create-tasks.mjs                   -> preview only, sends nothing
//   START=10 TOKEN=your_token node create-tasks.mjs   -> resume from task #10
//
// Options (all optional, defaults below):
//   TASKS_FILE=tasks.txt     -> text file, one task per line: "Title. Description."
//                               (if not set, the built-in list below is used)
//   PROJECT_ID=65            -> project to create the tasks in
//   ASSIGNEE_IDS=7,12        -> comma-separated user ids to assign
//   FIRST_SORT=25            -> sort number of the first task
//
// Example:
//   TASKS_FILE=tasks.txt PROJECT_ID=70 ASSIGNEE_IDS=7,12 TOKEN=xxx node create-tasks.mjs
// Requires Node 18+ (built-in fetch).

import { readFileSync } from 'node:fs';

const API_URL = 'https://tasks-api.echop.us/api/tasks';
const TOKEN = process.env.TOKEN;
const DRY_RUN = process.env.DRY_RUN === '1';
const START = Number(process.env.START || 1); // 1-based index in the list
const FIRST_SORT = Number(process.env.FIRST_SORT || 25); // each new task gets the next number
const PROJECT_ID = Number(process.env.PROJECT_ID || 65);
const ASSIGNEE_IDS = (process.env.ASSIGNEE_IDS || '7')
  .split(',').map(s => s.trim()).filter(Boolean).map(Number);
const DELAY_MS = 300;
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 30); // tasks per batch
const BATCH_PAUSE_MS = Number(process.env.BATCH_PAUSE_MIN || 2) * 60 * 1000; // wait between batches

// Fixed fields copied from your example request
const BASE = {
  project_id: PROJECT_ID,
  task_status_id: 1,
  task_priority_id: 3,
  category: null,
  due_date: null,
  branch_name: null,
  assignee_ids: ASSIGNEE_IDS,
  sprint_id: null,
  epic_id: null,
};

// Default list, used when TASKS_FILE is not set.
// "Set up the admin app" is left out because your example request already created it (201).
const DEFAULT_TASKS = `
Build the admin page frame. Side nav, top nav, and the main content area.
Build the mobile navigation. Collapsible menu for small screens.
Add light and dark mode. Theme toggle saved across the dashboard.
Group the side menu. Overview, reviews, users, commerce, finance, learning, safety, content, and system.
Show pending badges in the menu. Counts for products waiting for review, withdrawals, link requests, media, and complaints.
Build the login page. Email and password form at /admin/login, with validation and API errors.
Build forgot password. Request reset at /admin/forgot-password.
Build the profile page. Admin name, email, and account summary.
Build the sessions page. List active devices and allow revoking a session.
Protect admin routes. Guests go to login. A screen or menu item shows only if the user has the Spatie permission.
Build the 403 and 404 pages. No permission, and unknown /admin URLs.
Add English and Arabic. All labels through react-i18next, with RTL for Arabic and LTR for English.
Build the shared list and form. Data table, create/edit modal, file upload, and confirm dialog for row actions.
Build the API client. One Axios instance and the { success, data } response envelope. Calls stay in services.
Add an error boundary. A fallback screen when a page crashes.
Build home metric cards. Active children, sellers, orders to ship, and sales for the last 30 days.
Build the pending approvals inbox. Counts and links for products, stores, withdrawals, link requests, media, and complaints.
Build the sales trend. Daily orders and revenue for the last 30 days.
Build recent orders on the home page. Order number, buyer, store, total, status, and date, with a link to all orders.
Build orders by status on the home page. Counts from parent approval through completed and cancelled.
Build the sales report. Total revenue and transaction count.
Build the orders report. Total orders and a breakdown by status.
Build the users report. Total users and a breakdown by status.
Build the academy report. Total enrollments and completed enrollments.
List products waiting for admin approval. Image, name, store, seller, category, price, and quantity.
Publish an approved product. Confirm, then set the status to published.
Reject a product. Require a rejection reason and save it on the product.
List withdrawal requests. Parent, child, amount, wallet balance, bank, IBAN, status, notes, and date.
Approve a pending withdrawal. Confirm before calling the approve action.
Reject a pending withdrawal. Require a rejection note.
Mark an approved withdrawal as transferred. Optional transfer reference, only after approval.
List parent-child link requests. Parent, email, child, relationship, status, notes, and date.
Approve a link request. Confirm, only while the request is pending.
Reject a link request. Require a rejection note.
List media waiting for review. Preview, collection, uploader, status, notes, and date.
Approve uploaded media. Allowed only with the moderation permission.
Reject uploaded media. Require a rejection note.
List complaints. Subject, category, reporter, order number, description, status, and date.
Update a complaint. Change status and write an admin response.
List parents. Name, email, phone, status, children count, and created date.
Create and edit a parent. Email, phone, password, and status.
List children. Name, username, age, gender, parent, level, points, seller flag, status, and created date.
Create and edit a child. Parent, date of birth, gender, avatar, username, password, and status.
Grant seller access. Confirm, only for a child who is not a seller yet.
Revoke seller access. Confirm, only for a child who is already a seller.
List system users. Name, email, status, and roles.
Create and edit a user. Name, email, password, status, and assigned roles.
List roles. Name, guard, permission count, and created date.
Create and edit a role. Name, guard, and a grouped permission picker.
List stores. Name, owner, color, featured flag, status, and created date.
Create and edit a store. Owner, color, featured on the map, and status.
Approve a draft store. Confirm action, only while the store is in draft.
List store assets. Image, name, type (decoration, board, character), sort order, and active flag.
Create and edit a store asset. Type, bilingual name, image, sort order, and active flag.
List categories. Name, mall street, sort order, and active flag.
Create and edit a category. Bilingual name, street, icon, sort order, and active flag.
List products. Image, name, store, category, price, quantity, approval status, and rejection reason.
Create and edit a product. Store, category, bilingual name, image, price, and quantity.
List orders. Order number, buyer, store, subtotal, shipping fee, total, status, and date.
Move an order forward. Paid to preparing, preparing to shipped, shipped to delivered, delivered to completed.
Cancel an order. Allowed from pending, parent approval, or paid, and requires a reason.
Export orders for shipping. Pick a date, preview, then download the file.
List wallets. Child name, balance, and whether the wallet is locked.
List payments. Amount, method, status, gateway reference, and paid date.
List courses. Thumbnail, sort order, title, lesson count, quiz count, enrollment count, and published flag.
Create and edit a course. Bilingual title, thumbnail upload, sort order, and published flag.
List lessons. Course, sort order, title, video flag, duration, and published flag.
Create and edit a lesson. Course, bilingual title and content, video upload, duration, sort order, and published flag.
List quizzes. Course, title, question count, passing score, time limit, and published flag.
Create and edit a quiz. Course, bilingual title, passing score, time limit, and published flag.
List quiz questions. Quiz, question text, option count, correct answer, and points.
Create and edit a question. Quiz, bilingual question, up to four options, correct option, points, and sort order.
List games. Title, slug, points reward, and active flag.
Create and edit a game. Bilingual title, slug, points reward, and active flag.
List levels. Sort order, name, slug, minimum games, minimum sales, and active flag.
Create and edit a level. Bilingual name, slug, minimum games, minimum sales, sort order, and active flag.
List issued certificates. Certificate number, child, and issued date.
List notification templates. Slug, channel, subject, and active flag.
List predefined messages. Sort order, text, times sent, and active flag.
Create and edit a predefined message. Bilingual text, sort order, and active flag.
List child messages. Sender, recipient, text, related product, read flag, and sent date.
List moderation logs. User, blocked type (phone, email, address), field, content, and date.
List banners. Image, title, placement, sort order, end date, and active flag.
Create and edit a banner. Image, bilingual title and subtitle, link, placement (home, marketplace, academy), dates, sort order, and active flag.
List advertisements. Image, title, placement, end date, and active flag.
Create and edit an advertisement. Image, bilingual title and description, link, placement, dates, sort order, and active flag.
List the media library. Preview, collection, uploader, moderation status, notes, and date.
List audit logs. Action, resource, user, account type (admin, parent, child), IP address, and date.
Edit the shipping fee. Number setting under orders, saved with the settings permission.
Toggle login OTP channels. Email OTP and WhatsApp OTP switches on the settings page.
`;

const LINES = (process.env.TASKS_FILE ? readFileSync(process.env.TASKS_FILE, 'utf8') : DEFAULT_TASKS)
  .split(/\r?\n/).map(l => l.trim()).filter(Boolean);

// Split "Title. Description." at the first ". "
function parse(line) {
  const i = line.indexOf('. ');
  if (i === -1) return { title: line.replace(/\.$/, ''), description: '' };
  return { title: line.slice(0, i), description: line.slice(i + 2) };
}

// Wrap plain text in the editor's doc format (same shape as your example)
function toDoc(text) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: null },
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!DRY_RUN && !TOKEN) {
    console.error('Missing TOKEN. Run: TOKEN=your_token node create-tasks.mjs');
    process.exit(1);
  }

  if (!PROJECT_ID || ASSIGNEE_IDS.some(Number.isNaN)) {
    console.error('PROJECT_ID must be a number and ASSIGNEE_IDS a comma-separated list of numbers.');
    process.exit(1);
  }

  console.log(`${LINES.length} tasks in list, starting at #${START}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`project_id: ${PROJECT_ID}, assignee_ids: [${ASSIGNEE_IDS.join(', ')}]\n`);

  for (let n = START; n <= LINES.length; n++) {
    const { title, description } = parse(LINES[n - 1]);
    const body = { ...BASE, title, description: toDoc(description), sort: FIRST_SORT + n - 1 };

    if (DRY_RUN) {
      console.log(`#${n} [sort ${body.sort}] ${title}\n     ${description}`);
      continue;
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`\n#${n} FAILED (${res.status}): ${title}\n${text.slice(0, 500)}`);
      console.error(`\nFix the issue, then resume with: START=${n} TOKEN=... node create-tasks.mjs`);
      process.exit(1);
    }

    console.log(`#${n} created: ${title}`);
    await sleep(DELAY_MS);

    const done = n - START + 1;
    if (done % BATCH_SIZE === 0 && n < LINES.length) {
      console.log(`\n--- ${done} created, waiting ${BATCH_PAUSE_MS / 60000} min before next batch ---\n`);
      await sleep(BATCH_PAUSE_MS);
    }
  }

  console.log('\nDone.');
}

main();
