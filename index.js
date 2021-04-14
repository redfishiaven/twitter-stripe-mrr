require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_API_KEY)
const { getUnixTime, endOfMonth, startOfMonth } = require("date-fns")

const Twitter = require("twitter")

const EXPECTED_ENV_VARS = [
  "TWITTER_CONSUMER_KEY",
  "TWITTER_CONSUMER_SECRET",
  "TWITTER_ACCESS_TOKEN_KEY",
  "TWITTER_ACCESS_TOKEN_SECRET",
  "STRIPE_API_KEY",
]

async function removeMe() {
  // let's assume my goal is $5k
  // and there are 10 squares to fill
  const GOAL = 5000
  const numOfTenRounded = ((totalRevenueForMonth / GOAL) * 10).toPrecision(1)

  const mrrSquares = buildMRRIconsForTwitter(numOfTenRounded, GOAL)
  const params = {
    location: mrrSquares,
  }

  // credit here: https://dev.to/deta/how-i-used-deta-and-the-twitter-api-to-update-my-profile-name-with-my-follower-count-tom-scott-style-l1j
  client.post("account/update_profile", params, (err) => {
    if (err) throw new Error("Failed to update profile")
    console.log("🎉 Success! Updated Twitter bio/location")
  })
}

/**
 * The main function which starts the script
 */
async function main() {
  try {
    // Verify that all the environment variables are set
    console.log(`LOG: Verifying environment variables...\n`)
    const ACTUAL_ENV_VARS = EXPECTED_ENV_VARS.map((envVar) =>
      getEnvironmentVariable(envVar)
    )

    if (EXPECTED_ENV_VARS.length === ACTUAL_ENV_VARS.length) {
      console.log(`\nLOG: Found all expected environment variables\n`)
    }

    // Use array destructuring to grab the environment variables
    const [
      TWITTER_CONSUMER_KEY,
      TWITTER_CONSUMER_SECRET,
      TWITTER_ACCESS_TOKEN_KEY,
      TWITTER_ACCESS_TOKEN_SECRET,
      STRIPE_API_KEY,
    ] = ACTUAL_ENV_VARS

    // Create the Twitter client
    const twitter = new Twitter({
      consumer_key: TWITTER_CONSUMER_KEY,
      consumer_secret: TWITTER_CONSUMER_SECRET,
      access_token_key: TWITTER_ACCESS_TOKEN_KEY,
      access_token_secret: TWITTER_ACCESS_TOKEN_SECRET,
    })

    await verifyTwitterCredentials(twitter)

    // Create the Stripe client
    const stripe = require("stripe")(STRIPE_API_KEY)

    await verifyStripeCredentials(stripe)
    // get Stripe revenue for month (make sure it works)
    // Remember January is 0
    // Get total for current month
    const startRangeTimestamp = getUnixTime(new Date(startOfMonth(new Date())))
    const endRangeTimestamp = getUnixTime(new Date(endOfMonth(new Date())))

    const totalRevenueForMonth = await getStripeRevenue(
      startRangeTimestamp,
      endRangeTimestamp
    )

    console.log(`💰 Total revenue for month: ${totalRevenueForMonth}`)

    // let's assume my goal is $2k
    // and there are 10 squares to fill
    const GOAL = 2000
    console.log(`\nLOG: Calculating MRR squares using goal of ${GOAL}\n`)
    const numOfTenRounded = ((totalRevenueForMonth / GOAL) * 10).toPrecision(1)

    const mrrIcons = buildMRRIconsForTwitter(numOfTenRounded, GOAL)
    console.log(`⬜ ${mrrIcons}`)
    const params = {
      location: mrrIcons,
    }
  } catch (error) {
    console.error(error)
  }
}

var args = process.argv.slice(2)
console.log("hello args", args)
// use --dry-run here

main()

//////////////////////////////
// Helper Functions
/////////////////////////////

/**
 * Grabs the environment variable based off the name
 * @param {string} name the name of the variable
 * @returns {string} the variable if it exists or throws an error
 */
function getEnvironmentVariable(name) {
  if (!process.env[name]) {
    throw new Error(`❌ ERROR: could not find ${name} in your environment.`)
  }

  console.log(`✅ Found ${name} in environment.`)
  return process.env[name]
}

/**
 * Formats a number to have a K or not
 * @param {number} num the number to format
 * @returns {string} the `num` formatted with "K"
 * @example kFormatter(5000) => 5K
 * @link https://stackoverflow.com/a/9461657/3015595 for more information
 */
function kFormatter(num) {
  return Math.abs(num) > 999
    ? Math.sign(num) * (Math.abs(num) / 1000).toFixed(1) + "K"
    : Math.sign(num) * Math.abs(num)
}

/**
 * Verifies your Twitter credentials
 * @param client The Twitter client
 * @returns {undefined}
 *
 * See this {@link https://dev.to/deta/how-i-used-deta-and-the-twitter-api-to-update-my-profile-name-with-my-follower-count-tom-scott-style-l1j| Twitter tutorial} for more information about working with the Twitter API
 */
async function verifyTwitterCredentials(client) {
  return await client.get("account/verify_credentials", (err, res) => {
    if (err) {
      console.error(err)
      throw new Error(`❌ ERROR: could not verify your Twitter credentials`)
    }
    if (res) {
      const followerCount = res.followers_count
      console.log(`✅ Verified your Twitter credentials using follower count.`)
      console.log(`#️⃣  Your current follower count is ${followerCount}`)
    }
  })
}

/**
 * Verifies your Stripe credentials
 * @param client The Stripe client
 * @returns {undefined}
 *
 * See this {@link https://stripe.com/docs/development/quickstart| Stripe tutorial} for more information
 */
async function verifyStripeCredentials(client) {
  return await stripe.paymentIntents.create(
    {
      amount: 1000,
      currency: "usd",
      payment_method_types: ["card"],
      receipt_email: "jenny.rosen@example.com",
    },
    (err, res) => {
      if (err) {
        console.error(err)
        throw new Error(`❌ ERROR: could not verify your Twitter credentials`)
      }
      if (res) {
        const { amount, currency } = res
        console.log(
          `✅ Verified your Stripe credentials by creating a PaymentIntent.`
        )
        console.log(
          `💰 A payment intent of ${amount} ${currency.toUpperCase()} was created`
        )
      }
    }
  )
}

const iconsTypes = {
  square: { green: "🟩", yellow: "🟨", gray: "⬜" },
  circle: { green: "🟢", yellow: "🟡", gray: "⚪" },
}

/**
 * @param {number} n - the progress towards goal out of 10
 * @param {string} icon - the progress Icon (square or circle)
 * @example there are ten squares total, and n is 5, then it should return
 * "MRR: 0 🟩🟩🟩🟩🟩🟨⬜⬜⬜⬜  5K" or "MRR: 0 🟢🟢🟢🟢🟢🟡⚪⚪⚪⚪  5K"
 */
function buildMRRIconsForTwitter(n, goal, icon = "square") {
  const GOAL_AS_K = kFormatter(goal)
  let SQUARES = ""
  let count = 0

  // Add green squares
  for (let i = 0; i < n; i++) {
    SQUARES += iconsTypes[icon].green
    count += 1
  }

  // Add one after the last green for progress
  if (count !== 10) {
    SQUARES += iconsTypes[icon].yellow
    count += 1
  }

  // Fill the rest with white squares
  if (count !== 10) {
    for (let i = count; i < 10; i++) {
      SQUARES += iconsTypes[icon].gray
      count += 1
    }
  }

  return `MRR: 0 ${SQUARES} ${GOAL_AS_K}`
}

/**
 * Calculates the total monthly revenue in Stripe
 *
 * @param {number} startRangeTimestamp - the start range of the month
 * @param {number} endRangeTimestamp - the end range of the month
 * @returns {number} the total
 */
async function getStripeRevenue(startRangeTimestamp, endRangeTimestamp) {
  // credit here: https://stackoverflow.com/a/53775391/3015595
  const payoutsInCents = await stripe.payouts.list({
    created: { gte: startRangeTimestamp, lte: endRangeTimestamp },
    limit: 100, // Maximum limit (10 is default)
  })

  if (!payoutsInCents) {
    console.log(`LOG: payoutsInCents`, payoutsInCents)
    console.error(
      `❌ ERROR: either couldn't get payouts from Stripe or none found for this date range`
    )
    console.log(
      `LOG: This may happen if you run this at the start of the month and there are no payouts yet.`
    )
    console.log(
      `LOG: Try changing the startRangeTimestamp or endRangeTimestamp.`
    )
    return 0
  }

  // payouts returned by Stripe API are in cents, so we divide by 100
  const payouts = payoutsInCents.data.map((payout) => {
    return payout.amount / 100
  })

  if (!payouts) {
    console.error(
      `❌ ERROR: Something went wrong converting the payoutsInCents to dollars`
    )
    console.log(`LOG: payoutsInCents`, payoutsInCents)
    console.log(`LOG: payouts`, payouts)
    return 0
  }

  const amountTotal = calculateAmountTotal(payouts)

  if (!amountTotal) {
    console.error(`❌ ERROR: Something went wrong calculating the total amount`)
    console.log(`LOG: payoutsInCents`, payoutsInCents)
    console.log(`LOG: payouts`, payouts)
    console.log(`LOG: amountTotal`, amountTotal)
    return 0
  }

  return amountTotal
}

/**
 * Calculates the the total monthly amount based on a Stripe payouts list
 * @param {number}[]} payouts - list of payouts in number
 * @returns {number} the total
 */
function calculateAmountTotal(payouts) {
  if (payouts.length === 0) {
    return 0
  }

  // Some months there may have one payout
  if (payouts.length === 1) {
    return payouts[0]
  }

  return payouts.reduce((a, b) => ({
    amount: a + b,
  })).amount
}

//////////////////////////////
// Helper Functions (end)
/////////////////////////////
