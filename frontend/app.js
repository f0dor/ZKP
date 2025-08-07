document.addEventListener("DOMContentLoaded", async () => {
  // --- DOHVAĆANJE ELEMENATA ---
  const steps = {
    step0: document.getElementById("step0"),
    step1: document.getElementById("step1"),
    step2: document.getElementById("step2"),
    step3: document.getElementById("step3"),
  };
  const loginForm = document.getElementById("login-form");
  const voterSecretSelect = document.getElementById("voter-secret-select");
  const voterDisplay = document.getElementById("voter-display");
  const form = document.getElementById("vote-form");
  const statusEl = document.getElementById("status");
  const trackerCodeEl = document.getElementById("tracker-code");
  const finalTrackerCodeEl = document.getElementById("final-tracker-code");
  const auditDetailsEl = document.getElementById("audit-details");
  const auditBtn = document.getElementById("audit-btn");
  const sendBtn = document.getElementById("send-btn");
  const resetBtn = document.getElementById("reset-btn");

  // --- UPRAVLJANJE STANJEM ---
  let preparedVote = null;
  let isInAuditMode = false;
  let currentUser = null;

  // Lista preddefiniranih tajni za demo svrhu
  const voterSecrets = [
    { id: 1, secret: BigInt(123456789) },
    { id: 2, secret: BigInt(987654321) },
    { id: 3, secret: BigInt(112233445) },
    { id: 4, secret: BigInt(556677889) },
    { id: 5, secret: BigInt(135792468) },
  ];

  // Učitavamo Poseidon hash funkciju
  const poseidon = await circomlibjs.buildPoseidon();

  // --- FUNKCIJE ---
  function showStep(stepName) {
    Object.values(steps).forEach((step) => step.classList.remove("active"));
    steps[stepName].classList.add("active");
  }

  function populateVoterSecrets() {
    voterSecrets.forEach((v) => {
      const option = document.createElement("option");
      option.value = v.secret.toString();
      option.textContent = `Glasač ${v.id}`;
      voterSecretSelect.appendChild(option);
    });
  }

  function login() {
    const selectedSecret = BigInt(voterSecretSelect.value);
    currentUser = voterSecrets.find((v) => v.secret === selectedSecret);
    if (currentUser) {
      voterDisplay.textContent = `Glasač ${currentUser.id}`;
      statusEl.innerHTML = "<p>Odaberi kandidata i pripremi svoj glas.</p>";
      showStep("step1");
    }
  }

  async function prepareVote() {
    const formData = new FormData(form);
    const vote = parseInt(formData.get("candidate"), 10);

    statusEl.innerHTML =
      "<p>Izračunavam poništivač i pripremam dokaz... Ovo može potrajati.</p>";

    // Izračunaj poništivač (nullifier) koristeći Poseidon hash
    const nullifier = poseidon.F.toObject(poseidon([currentUser.secret]));

    const inputs = {
      vote: vote,
      choice: [vote === 1 ? 1 : 0, vote === 2 ? 1 : 0, vote === 3 ? 1 : 0],
      voterSecret: currentUser.secret,
      validCandidates: [1, 2, 3],
      nullifier: nullifier,
    };

    console.log("Input to circuit:", inputs);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      "vote.wasm",
      "vote_final.zkey"
    );

    const trackerCode = sha256(JSON.stringify(proof));
    preparedVote = { proof, publicSignals, trackerCode, inputs };

    trackerCodeEl.textContent = trackerCode;
    statusEl.innerHTML =
      "<p>Glas je pripremljen. Odluči želiš li ga auditirati ili poslati.</p>";
    showStep("step2");
  }

  async function sendVote() {
    if (!preparedVote) return;
    statusEl.innerHTML = "<p>Šaljem glas na verifikaciju...</p>";

    try {
      const { proof, publicSignals, trackerCode } = preparedVote;
      const response = await fetch("http://localhost:3000/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, publicSignals, trackerCode }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      finalTrackerCodeEl.textContent = trackerCode;
      statusEl.innerHTML = `<p style="color: green;">✅ Uspjeh! ${result.message}</p>`;
      showStep("step3");
    } catch (err) {
      console.error(err);
      statusEl.innerHTML = `<p style="color: red;">❌ Greška: ${err.message}</p>`;
      showStep("step2");
    }
  }

  function enterAuditMode() {
    if (!preparedVote) return;
    isInAuditMode = true;
    sendBtn.disabled = true;
    auditBtn.textContent = "Vrati se na početak";

    auditDetailsEl.innerHTML = `
            <h4>Detalji audita</h4>
            <p>Ovaj glas je sada "potrošen" i ne može se poslati.</p>
            <ul>
                <li><strong>Tvoja tajna (secret):</strong> ${
                  preparedVote.inputs.voterSecret
                }</li>
                <li><strong>Izračunati poništivač (nullifier):</strong> ${
                  preparedVote.inputs.nullifier
                }</li>
                <li><strong>Tvoj odabir (vote):</strong> ${
                  preparedVote.inputs.vote
                }</li>
                <li><strong>"One-hot" vektor (choice):</strong> [${preparedVote.inputs.choice.join(
                  ", "
                )}]</li>
            </ul>
        `;
    auditDetailsEl.style.display = "block";
    statusEl.innerHTML = "<p>Glas auditiran. Pripremi novi glas.</p>";
  }

  function reset() {
    preparedVote = null;
    isInAuditMode = false;
    currentUser = null;

    form.reset();
    auditDetailsEl.style.display = "none";
    auditDetailsEl.innerHTML = "";
    sendBtn.disabled = false;
    auditBtn.textContent = "Auditiraj ovaj glas";

    statusEl.innerHTML = "<p>Molimo, prijavite se.</p>";
    showStep("step0");
  }

  // --- DODJELA DOGAĐAJA ---
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    prepareVote();
  });

  sendBtn.addEventListener("click", sendVote);

  auditBtn.addEventListener("click", () => {
    if (isInAuditMode) {
      reset();
    } else {
      enterAuditMode();
    }
  });

  resetBtn.addEventListener("click", reset);

  // --- INICIJALIZACIJA ---
  populateVoterSecrets();
  showStep("step0");
});
