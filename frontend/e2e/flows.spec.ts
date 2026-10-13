import { test, expect } from "@playwright/test";

function createUniqueUser(prefix: string) {
  const id = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return {
    name: `${prefix} User`,
    email: `${prefix}_${id}@example.com`,
    phone: "+919876543210",
    password: "SecurePassword123!",
  };
}

test.describe("Critical User Flows (E2E)", () => {
  // Flow 1: Owner onboarding to monitoring on
  test("Flow 1: Owner onboarding to monitoring on", async ({ page }) => {
    const user = createUniqueUser("onboard");

    // 1. Register owner account
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /create your/i })).toBeVisible();

    await page.getByLabel(/full name/i).fill(user.name);
    await page.getByLabel(/email address/i).fill(user.email);
    await page.getByLabel(/mobile number/i).fill(user.phone);
    await page.getByLabel(/password/i).fill(user.password);

    await page.getByRole("button", { name: /create account/i }).click();

    // 2. Wait for redirect to dashboard after registration
    await expect(page.getByRole("button", { name: /i'm okay/i })).toBeVisible();

    // 3. Navigate to Contacts & add trusted family contact
    await page.goto("/contacts");
    await expect(page.getByRole("heading", { level: 1, name: /trusted contacts/i })).toBeVisible();

    const addContactBtn = page.getByRole("button", { name: /add (your first )?contact/i });
    await expect(addContactBtn.first()).toBeVisible();
    await addContactBtn.first().click();

    await page.getByLabel(/full name/i).fill("Sunita Sharma");
    await page.getByLabel(/relationship/i).selectOption("mother");
    await page.getByLabel(/mobile phone number/i).fill("+919876543211");
    await page.getByLabel(/email address/i).fill("sunita@example.com");
    await page.getByRole("button", { name: /add contact/i }).click();

    // Verify contact card is created
    await expect(page.getByText("Sunita Sharma")).toBeVisible();

    // 4. Navigate to Loans & configure car loan
    await page.goto("/loans");
    await expect(page.getByRole("heading", { level: 1, name: /car loan/i })).toBeVisible();

    const configLoanBtn = page.getByRole("button", { name: /configure car loan/i });
    await expect(configLoanBtn).toBeVisible();
    await configLoanBtn.click();

    await page.locator("#loan-lender").fill("HDFC Bank");
    await page.locator("#loan-account").fill("1234567890");
    await page.locator("#loan-emi").fill("16166");
    await page.locator("#loan-due-day").fill("24");
    await page.getByRole("button", { name: /save loan/i }).click();

    // Confirm loan card is displayed
    await expect(page.getByText("HDFC Bank")).toBeVisible();

    // 5. Preview as parent under Notifications
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { level: 1, name: /emergency notifications/i }),
    ).toBeVisible();
    await page.getByRole("tab", { name: /preview as parent/i }).click();
    await expect(page.getByText(/preview, nothing has been sent/i)).toBeVisible();

    // 6. Navigate to Dashboard & confirm active monitoring
    await page.goto("/");
    await expect(page.getByRole("button", { name: /i'm okay/i })).toBeVisible();
  });

  // Flow 2: Check-in resets the clock
  test("Flow 2: Check-in resets the clock", async ({ page }) => {
    const user = createUniqueUser("checkin");

    // Register & login
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill(user.name);
    await page.getByLabel(/email address/i).fill(user.email);
    await page.getByLabel(/mobile number/i).fill(user.phone);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /create account/i }).click();

    const checkInBtn = page.getByRole("button", { name: /i'm okay/i });
    await expect(checkInBtn).toBeVisible();
    await checkInBtn.click();

    // Confirm check-in feedback appears
    await expect(page.getByText(/check-in recorded!/i)).toBeVisible();
  });

  // Flow 3: EMI missed then paid late
  test("Flow 3: EMI installment marked paid", async ({ page }) => {
    const user = createUniqueUser("emi");

    // Register
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill(user.name);
    await page.getByLabel(/email address/i).fill(user.email);
    await page.getByLabel(/mobile number/i).fill(user.phone);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByRole("button", { name: /i'm okay/i })).toBeVisible();

    // Create loan
    await page.goto("/loans");
    const configLoanBtn = page.getByRole("button", { name: /configure car loan/i });
    await expect(configLoanBtn).toBeVisible();
    await configLoanBtn.click();

    await page.locator("#loan-lender").fill("HDFC Bank");
    await page.locator("#loan-account").fill("1234567890");
    await page.locator("#loan-emi").fill("16166");
    await page.locator("#loan-due-day").fill("24");
    await page.getByRole("button", { name: /save loan/i }).click();

    await expect(page.getByText("HDFC Bank")).toBeVisible();

    // Click I Paid / Mark Paid button on the installment timeline
    const iPaidBtn = page.getByRole("button", { name: /(mark paid|i paid)/i }).first();
    await expect(iPaidBtn).toBeVisible();
    await iPaidBtn.click();

    // Dialog opens with reference and note inputs
    await expect(page.getByRole("heading", { name: /record emi payment/i })).toBeVisible();
    await page.locator("#payment-reference").fill("UTR987654321");
    await page.locator("#payment-notes").fill("Paid via Netbanking");
    await page.getByRole("button", { name: /confirm payment/i }).click();

    // Status resolves
    await expect(page.getByText(/payment recorded/i)).toBeVisible();
  });

  // Flow 4: Parent packet page
  test("Flow 4: Parent packet page OTP and access", async ({ page }) => {
    const userTag = Date.now();
    const ownerEmail = `parent_packet_${userTag}@example.com`;

    // 1. Setup owner, contact, and packet share link via direct backend API
    const regRes = await page.request.post("http://127.0.0.1:8000/api/v1/auth/register", {
      data: {
        name: "Tanmoy Sharma",
        email: ownerEmail,
        phone: "+919876543210",
        password: "SecurePassword123!",
      },
    });
    expect(regRes.ok()).toBeTruthy();

    const loginRes = await page.request.post("http://127.0.0.1:8000/api/v1/auth/login", {
      data: {
        email: ownerEmail,
        password: "SecurePassword123!",
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const csrfToken = loginData.csrf_token;

    const contactRes = await page.request.post("http://127.0.0.1:8000/api/v1/contacts", {
      headers: { "X-CSRF-Token": csrfToken },
      data: {
        name: "Sunita Sharma",
        relation: "mother",
        phone: "+919876543211",
        email: "sunita@example.com",
        priority: 1,
        locale: "en",
      },
    });
    expect(contactRes.ok()).toBeTruthy();
    const contactData = await contactRes.json();

    const shareRes = await page.request.post("http://127.0.0.1:8000/api/v1/packet/shares", {
      headers: { "X-CSRF-Token": csrfToken },
      data: {
        contact_id: contactData.id,
      },
    });
    expect(shareRes.ok()).toBeTruthy();
    const shareData = await shareRes.json();
    const token = shareData.token;

    // 2. Parent navigates to the shared packet link
    await page.goto(`/p/${token}`);

    // Pre-OTP view
    await expect(
      page.getByRole("heading", { name: /emergency guidance for tanmoy sharma's family/i }),
    ).toBeVisible();

    const sendCodeBtn = page.getByRole("button", { name: /send me a code/i });
    await expect(sendCodeBtn).toBeVisible();
    await sendCodeBtn.click();

    // 3. Enter 6-digit OTP
    const otpInput = page.getByLabel(/one-time verification code/i);
    await expect(otpInput).toBeVisible();
    await otpInput.fill("123456");

    await page.getByRole("button", { name: /view emergency packet/i }).click();

    // 4. Emergency packet unlocked
    await expect(page.getByText(/groww investment records/i)).toBeVisible();
    await expect(
      page.getByText(
        /claim requirements can change\. please confirm directly with the respective financial institutions\./i,
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /print \/ save pdf/i })).toBeVisible();
  });
});
