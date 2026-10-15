# Missionary Website — Project Context and Next Development Task

## 1. Read This First

You are working on my personal missionary website.

I want you to act as my website developer, directly inspecting, editing, testing, and improving the existing code in this repository.

**I do not want instructions for another coding agent. I want you to make the changes in the actual project files.**

Before making changes, inspect the repository so you understand how everything currently works.

Preserve the existing design, functionality, and integrations wherever possible. Build onto what already exists rather than rebuilding the website.

## 2. Background — Who I Am and Why This Website Exists

My name is Logan Doyle. I am a missionary serving with Youth With A Mission (YWAM).

I've completed a Discipleship Training School with YWAM Montana, participated in outreach in Thailand, and served on staff with YWAM in New Zealand.

I am continuing my biblical education and ministry training. My long-term goal is to grow in my understanding of Scripture so that I can teach, disciple, and serve people through missions.

My website has several purposes:

1. Share who I am, my testimony, and what God has been doing through missions.
2. Share ministry updates and connect people with my work.
3. Build a consistent team of monthly financial supporters.
4. Raise designated funds for future biblical training schools.
5. Share my long-term ministry vision.
6. Allow people to join my newsletter and connect through social media.
7. Offer missionary merchandise through an external fulfillment provider.

I want the website to feel personal, professional, simple, and transparent.

It should feel like someone is partnering with an actual missionary, not donating to an impersonal fundraising organization.

## 3. What We've Already Worked On

The project is called `missionary-website-starter`.

### Existing technical setup

Previous versions of the project have used:

- Node.js
- `server.js` for the backend
- HTML, CSS, and JavaScript in `public/`
- `package.json` with `npm start`
- Environment variables stored in `.env`
- GitHub for version control
- Render for deployment

The GitHub repository has previously been `Ldoyle2006/Logan.missions`.

The website has previously been deployed at `logan-missions.onrender.com`.

Verify the current repository, hosting, and structure before relying on these details.

### Website pages and features

We have previously worked on:

- Homepage
- Giving page
- My Vision page
- Shop page
- Privacy page
- Newsletter subscriptions
- Social media and WhatsApp links
- Stripe donation functionality
- Fourthwall merchandise integration

Previous work included creating a Vision page and modifying the Giving page.

Some updates were made locally, and some were only drafted or discussed. Do not assume that every planned feature has already been implemented.

**The current repository is the source of truth.**

### Existing payment work

Earlier versions of `server.js` included routes such as:

- `GET /donate`
- `GET /api/config`
- `POST /api/create-donation-intent`
- `POST /api/stripe-webhook`

Stripe has been the primary payment integration discussed and partly implemented.

The donation experience has been designed around allowing a supporter to:

1. Choose a donation amount.
2. Choose a giving frequency.
3. Enter any required information.
4. Continue to a secure payment checkout.

We have discussed preset donation amounts, custom donation amounts, monthly donations, every-two-week donations, and one-time donations.

We have also discussed other giving methods, including Equipnet, Venmo, and Cash App. These should not be assumed to have automated tracking integrations.

Inspect the actual code to identify what is implemented and working.

Some earlier Stripe work used test mode with safeguards before enabling live payments. Preserve those safeguards.

Do not remove or break working payment functionality.

### Merchandise

The merchandise side of the website uses, or is being developed around, Fourthwall for its products and fulfillment.

This is separate from donations.

Do not change the merchandise integration or interfere with storefront credentials while working on Giving and Vision.

## 4. The Main Problem We Are Solving

Currently, I want to separate two types of financial support.

**A. Regular Monthly Missionary Support**

This is money given toward my everyday living, ministry, and personal financial responsibilities while serving with YWAM.

**B. Designated Biblical Training Donations**

These are donations specifically given toward future ministry training schools.

I do not want someone donating $100 toward a Bible school and having that donation automatically treated like my general spending money.

If a supporter chooses a specific school, the website needs to record that designation.

I also want to know when those funds need to be allocated to savings.

The general Giving page and the school fundraisers should operate independently.

---

# PART ONE — UPDATE THE GIVING PAGE

## 5. Monthly Support Goal

My new regular monthly support target is:

**$2,000 per month**

This replaces the earlier $2,700 monthly target, which included Bible Core Course savings.

The revised $2,000 does not include savings for future biblical training schools.

### Living and Ministry Expenses — $1,420/month

| Expense | Monthly Amount |
|---|---:|
| YWAM base housing and fees | $550 |
| Diakonos leadership course | $325 |
| Food | $180 |
| Phone | $40 |
| Subscriptions | $25 |
| Health insurance (estimated) | $200 |
| Hygiene and personal care | $50 |
| Local transportation | $50 |
| **Total** | **$1,420** |

### Financial Responsibilities and Savings — $400/month

| Expense | Monthly Amount |
|---|---:|
| Credit card debt payments | $250 |
| Dental savings | $50 |
| Emergency savings | $100 |
| **Total** | **$400** |

### Annual Travel Home — $85/month

I would like to visit my family in Idaho approximately once per year.

The estimated annual budget is $1,000, which I plan to save for monthly.

### Overall Monthly Budget

| Category | Monthly |
|---|---:|
| Living and Ministry | $1,420 |
| Financial Responsibilities and Savings | $400 |
| Annual Travel Home | $85 |
| Additional flexibility | $95 |
| **Monthly Support Target** | **$2,000** |

### Giving Page Design Requirements

Display the monthly support target clearly.

Underneath, display the three main categories:

- Living and Ministry
- Financial Responsibilities and Savings
- Annual Travel Home

I would like each category to be expandable so people can see exactly where the money goes without overwhelming the page.

Show the $95 flexibility amount in the complete budget.

Make it clear that the health insurance amount is an estimate.

Do not disguise credit card debt payments as direct ministry expenses. The budget should be honest about personal financial responsibilities.

**Do not put a thermometer, donation progress bar, or fundraising percentage on the regular Giving page.**

Preserve the existing one-time, monthly, and every-two-week giving functionality if currently available.

Keep all regular support donations in the general support category.

Do not add future school tuition costs to this budget.

---

# PART TWO — FUTURE MINISTRY TRAINING ON THE VISION PAGE

## 6. Future Ministry Schools

On my existing Vision page, create or update a section called:

**Future Ministry Training**

This section should communicate why I am pursuing further biblical education.

The purpose is to prepare myself for teaching Scripture, discipleship, missions, and leadership.

I have three specific schools that I want to raise money for.

### School 1 — Bible Core Course on Location

- School: Bible Core Course on Location
- Expected start: September 2027
- Fundraising goal: $8,300
- Identifier: `bcc`

This is my highest-priority school.

### School 2 — Word by Heart

- School: Word by Heart
- Date: To be determined
- Fundraising goal: $5,000
- Identifier: `word_by_heart`

This school focuses on learning, internalizing, and communicating Scripture.

### School 3 — School of Biblical Studies

- School: School of Biblical Studies
- Date: To be determined
- Fundraising goal: $10,000
- Identifier: `sbs`

This is a longer-term goal to study the Bible in greater depth.

These school costs are current planning estimates and may change. Make their goals and dates editable.

**Only these three schools should appear in the school fundraising section.**

We have also discussed a possible three-month South America trip, but that should not be added to these school fundraisers.

## 7. Individual School Funding Cards

Each school should have its own card.

Every card needs:

- School name
- Expected start date
- Total amount needed
- Total amount raised
- Remaining amount
- Percentage funded
- Visual thermometer-style progress bar
- "Give Towards This School" button

Make each tracker independent.

If someone gives $100 to Word by Heart, the Bible Core Course tracker should not change.

The thermometer should visually fill based on the confirmed amount raised.

The amount remaining should automatically update.

Use real donation data, not placeholder funding totals.

I have not yet provided confirmed starting amounts for the schools.

Until I enter those values through the admin system, show something like:

"Funding progress not yet updated."

Do not invent amounts already raised or silently treat unknown balances as confirmed $0.

---

# PART THREE — SCHOOL-SPECIFIC DONATIONS

## 8. Donation Checkout

When someone clicks "Give Towards This School," they should be able to make a donation specifically designated to that school.

Example:

A supporter opens the Vision page and selects Bible Core Course.

They click "Give Towards This School."

They choose to donate $100.

They complete checkout through the payment provider.

After the provider verifies the successful payment, the website records $100 as a designated BCC donation.

The BCC progress tracker updates.

The other school trackers and the general monthly support budget do not change.

### Important Technical Requirements

Use the existing payment provider and server structure where possible.

For school-specific donations, use these identifiers:

- `bcc`
- `word_by_heart`
- `sbs`

Store the designation server-side in the donation record and the payment provider's supported metadata.

The school checkout must clearly show the designation to the donor.

Do not rely on client-submitted amounts or identifiers without server-side validation.

School donations can initially use one-time checkout unless the existing system already supports designated recurring donations safely.

## 9. Verified Payment Tracking

A progress bar must only update after actual payment confirmation.

Do not update the fundraiser when:

- Someone clicks the Give button.
- Someone opens checkout.
- Someone reaches a success URL without verified payment.
- A payment fails or is canceled.

Use a secure, verified webhook or an equivalent authoritative payment confirmation system.

Handle delayed payments correctly.

Store donation records persistently.

Prevent duplicate processing of webhook events and payment transactions.

Account for partial and full refunds.

Reconcile payment amounts and fees when the provider makes that information available.

For the public progress tracker, use confirmed gross donations minus refunds, along with verified offline donations and any manually entered starting funds.

Track processing fees and net savings allocations separately.

Never count general support donations toward a school unless they were specifically designated or an authorized administrator records a legitimate correction.

---

# PART FOUR — AUTOMATIC SAVINGS NOTIFICATIONS

## 10. Donation Notifications

Whenever I receive a confirmed donation specifically designated for one of the schools, send an email notification to my configured email address.

The notification should contain:

- School name
- Donation amount
- Payment date
- Processing fees, once available
- Net amount available for savings
- A reminder to transfer that money into the appropriate savings fund

Example:

**Subject: New BCC Donation — $100**

A supporter has donated $100 toward your Bible Core Course on Location.

School: Bible Core Course

Gross donation: $100

Processing fees: [confirmed fee or pending]

Net amount for savings: [confirmed amount or pending]

Action needed: Allocate the designated funds to your BCC savings account.

### Savings Allocation Tracking

I want to track the money separately from the fundraising progress.

Each school should have a savings-allocation record.

An incoming donation should initially have a savings status such as:

`Pending Transfer`

When I actually move the money into the appropriate savings account, I should be able to mark it:

`Transferred`

The website must not automatically claim that money has reached my savings account just because the donation was received.

Do not initiate bank transfers without a separate, properly authorized banking integration.

Ideally, I should be able to see the total designated funds received, confirmed net funds available for transfer, amounts already transferred, and amounts still pending.

Avoid sending duplicate donation notifications when the payment provider retries a webhook.

If email credentials are not available, implement the integration safely and document the setup needed. Do not pretend that emails were sent.

---

# PART FIVE — PRIVATE ADMIN CONTROLS

## 11. Admin Management

Create a private admin area for managing these school fundraisers.

If the website already has a secure admin system, use it.

If it does not, implement an appropriate secure authentication system rather than leaving financial records publicly accessible.

### I Need To Be Able To:

1. View the three school fundraising goals.
2. View verified donations for each school.
3. Enter an initial amount already raised.
4. Add offline donations, such as cash, bank transfers, or money received through another platform.
5. View payment fees and net amounts.
6. Record refunds and manual corrections.
7. Mark individual donations or grouped amounts as transferred to savings.
8. Update school goals and expected dates.
9. See which savings allocations remain pending.

Keep an audit record of administrative adjustments so donation totals can be reconciled.

Only an authenticated administrator should have access to private donation records and donor information.

Do not expose private administrative APIs or credentials in public frontend code.

Use a database or other reliable persistent storage that works with the actual hosting environment.

Do not rely on temporary local files for production donation records, especially if the hosting platform uses an ephemeral filesystem.

---

# PART SIX — DESIGN AND USER EXPERIENCE

## 12. Website Design

I already have a website design that I want to preserve.

Do not rebuild the website or randomly change colors, fonts, navigation, page structure, or other unrelated elements.

Improve the existing design where needed to support the new features.

### Giving Page

Keep it clean and simple.

The emphasis should be on:

- My $2,000 monthly support goal.
- Where the funds go.
- Why continued support matters.
- Giving options that already exist.

No progress bars.

### Vision Page

The emphasis should be on:

- My long-term calling and ministry goals.
- Why biblical education matters to my ministry.
- Three future schools.
- Individual funding progress.
- The option to donate directly to each school.

The three school cards should be visually consistent, responsive, and work on desktop and mobile devices.

Donors should clearly understand that general donations and school-specific donations serve different purposes.

Do not promise tax-deductible treatment unless the existing giving organization and payment arrangement actually support it.

---

# PART SEVEN — IMPLEMENTATION AND TESTING

## 13. How I Want You To Work

### Step 1 — Inspect

Before editing, inspect:

- Project structure
- `package.json`
- `server.js`
- Giving page
- Vision page
- Existing CSS
- Existing JavaScript
- Payment integrations
- Existing API routes
- Current environment-variable setup
- Current Git status
- Deployment configuration
- Available tests

Identify what already works and what needs to be added.

Check for uncommitted work and preserve it.

### Step 2 — Implement

Make the changes directly in the project.

Use the existing architecture rather than introducing an entirely new framework without a clear technical reason.

Preserve the existing donation flow for general supporters.

Create school-specific checkout functionality.

Implement the school progress tracking backend and frontend.

Implement persistent donation and savings-allocation tracking.

Add secure administrative controls.

Add the email notification integration.

Use environment variables for secrets and configuration.

If a missing external service or credential prevents a feature from working, implement what can be safely completed and document the blocker clearly.

### Step 3 — Test

Test the following:

- Giving page loads correctly.
- Monthly budget displays $2,000.
- All category totals add up correctly.
- Existing donation options still work.
- Vision page displays exactly three schools.
- School donation buttons open the correct checkout.
- Payments are assigned to the correct school.
- A successful test payment updates only the correct school.
- A failed or canceled payment does not change a total.
- Duplicate webhooks do not duplicate donations.
- Refunds reduce the applicable fundraising total.
- General donations do not increase school totals.
- Manual fundraising adjustments work.
- Savings transfers can be marked complete.
- Administrative pages require authentication.
- Notification emails work when properly configured.
- The website remains responsive on mobile.

Use Stripe test mode, or the payment provider's equivalent, during development.

Never use a real charge to test this functionality without my explicit approval.

### Step 4 — Report What Changed

After making the changes, give me a clear summary of:

1. Files changed.
2. Features completed.
3. Tests run and their results.
4. Features requiring external configuration.
5. Environment variables I need to configure.
6. Database or hosting changes needed.
7. Any problems or limitations.
8. How to start the project locally.
9. How to verify the Giving and Vision pages before deploying.

Do not claim something works unless you have tested it or have clear evidence.

Do not automatically push to GitHub or deploy changes without my approval.

---

## 14. Final Goal

I want my website to have two distinct types of financial partnership.

**Monthly Missionary Support**

People give toward my monthly living and ministry needs, with a target of $2,000/month.

**Future Ministry Training**

People intentionally choose one of three biblical training schools and give directly toward that school.

Each school tracks its fundraising progress independently.

I receive notifications so I know when money needs to be allocated to its designated savings fund.

I can manage the funds and record transfers privately.

Everything should work through my existing missionary website without disrupting its current features.

**Start by inspecting the repository. Then implement the requested changes directly, test them, and explain what was completed. Don't stop at giving me code examples or another development prompt.**