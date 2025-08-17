document.addEventListener("DOMContentLoaded", () => {
  // DOHVAĆANJE ELEMENATA
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

  // UPRAVLJANJE STANJEM
  let preparedVote = null;
  let isInAuditMode = false;
  let currentUser = null;
  const voterSecrets = [
    { id: 1, secret: BigInt(123456789) },
    { id: 2, secret: BigInt(987654321) },
    { id: 3, secret: BigInt(112233445) },
    { id: 4, secret: BigInt(556677889) },
    { id: 5, secret: BigInt(135792468) },
  ];

  // FUNKCIJE
  function simpleHash(secret) {
    return secret * secret + secret;
  }

  function showStep(stepName) {
    Object.values(steps).forEach((step) => step.classList.remove("active"));
    if (steps[stepName]) {
      steps[stepName].classList.add("active");
    }
  }

  async function populateVoterSecrets() {
    statusEl.innerHTML = "<p>Ažuriram listu glasača...</p>";
    let usedNullifierHashes = new Set();
    try {
      const response = await fetch(
        `http://localhost:3000/bulletin-board?t=${new Date().getTime()}`
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const ballots = await response.json();
      usedNullifierHashes = new Set(ballots.map((b) => b.publicSignals[3]));
    } catch (e) {
      console.error("Could not fetch used nullifiers.", e);
    }

    voterSecretSelect.innerHTML = "";
    let firstAvailableVoter = null;

    voterSecrets.forEach((v) => {
      const option = document.createElement("option");
      const voterNullifier = simpleHash(v.secret).toString();
      option.value = v.secret.toString();
      option.textContent = `Glasač ${v.id}`;
      if (usedNullifierHashes.has(voterNullifier)) {
        option.disabled = true;
        option.textContent += " (već glasao)";
      } else if (!firstAvailableVoter) {
        firstAvailableVoter = v;
      }
      voterSecretSelect.appendChild(option);
    });

    if (!firstAvailableVoter) {
      statusEl.innerHTML =
        "<p>Svi glasači su glasali! Resetirajte glasanje na stranici za zbrajanje.</p>";
      loginForm.querySelector("button").disabled = true;
    } else {
      statusEl.innerHTML = "<p>Molimo, prijavite se.</p>";
      loginForm.querySelector("button").disabled = false;
    }
  }

  function login() {
    if (!voterSecretSelect.value) return;
    const selectedSecret = BigInt(voterSecretSelect.value);
    currentUser = voterSecrets.find((v) => v.secret === selectedSecret);
    if (currentUser) {
      voterDisplay.textContent = `Glasač ${currentUser.id}`;

      const nullifier = simpleHash(currentUser.secret);
      document.getElementById("nullifier-display").textContent =
        nullifier.toString();

      statusEl.innerHTML = "<p>Odaberi kandidata i pripremi svoj glas.</p>";
      showStep("step1");
    }
  }

  async function prepareVote() {
    const formData = new FormData(form);
    const vote = parseInt(formData.get("candidate"), 10);
    statusEl.innerHTML =
      "<p>Izračunavam poništivač i pripremam dokaz... Ovo može potrajati.</p>";
    const nullifier = simpleHash(currentUser.secret);
    const inputs = {
      vote: vote,
      choice: [vote === 1 ? 1 : 0, vote === 2 ? 1 : 0, vote === 3 ? 1 : 0],
      voterSecret: currentUser.secret,
      validCandidates: [1, 2, 3],
      nullifier: nullifier,
    };
    console.time("Vrijeme generiranja dokaza za glas (frontend)");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      "vote.wasm",
      "vote_final.zkey"
    );
    console.timeEnd("Vrijeme generiranja dokaza za glas (frontend)");
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

      // NOVI DIO: "Enkripcija" (Base64 enkodiranje) vektora glasa
      const encryptedVector = btoa(JSON.stringify(preparedVote.inputs.choice));

      const response = await fetch("http://localhost:3000/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // AŽURIRANO: Šaljemo 'encryptedVector'
        body: JSON.stringify({
          proof,
          publicSignals,
          trackerCode,
          voteVector: encryptedVector,
        }),
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
            <p>Ovaj glas je sada "potrošen".</p>
            <ul>
                <li><strong>Tvoja tajna:</strong> ${preparedVote.inputs.voterSecret}</li>
                <li><strong>Izračunati poništivač:</strong> ${preparedVote.inputs.nullifier}</li>
                <li><strong>Tvoj odabir:</strong> ${preparedVote.inputs.vote}</li>
            </ul>
        `;
    auditDetailsEl.style.display = "block";
    statusEl.innerHTML = "<p>Glas auditiran. Pripremi novi glas.</p>";
  }

  // AŽURIRANA I POJEDNOSTAVLJENA RESET FUNKCIJA
  function reset() {
    window.location.reload();
  }

  // DODJELA DOGAĐAJA
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
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

  // INICIJALIZACIJA
  async function initialize() {
    await populateVoterSecrets();
    showStep("step0");
  }

  initialize();
});
