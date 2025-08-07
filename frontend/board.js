document.addEventListener("DOMContentLoaded", () => {
  const ballotListEl = document.getElementById("ballot-list");
  const voteCountEl = document.getElementById("vote-count");
  const searchBox = document.getElementById("search-box");
  const refreshBtn = document.getElementById("refresh-btn");
  let verificationKey = null;
  let allBallots = [];

  // Funkcija za dohvaćanje verifikacijskog ključa
  async function fetchVerificationKey() {
    try {
      const response = await fetch("verification_key.json");
      verificationKey = await response.json();
      console.log("Verification key loaded.");
    } catch (err) {
      console.error("Failed to load verification key:", err);
      ballotListEl.innerHTML =
        '<p style="color:red">Greška: Nije moguće učitati ključ za verifikaciju.</p>';
    }
  }

  // Funkcija za verifikaciju dokaza u pregledniku
  async function verifyProofInBrowser(ballotData, statusElement) {
    if (!verificationKey) {
      statusElement.textContent = "Ključ za verifikaciju nije učitan.";
      return;
    }
    statusElement.textContent = "Verificiram...";

    const isVerified = await snarkjs.groth16.verify(
      verificationKey,
      ballotData.publicSignals,
      ballotData.proof
    );

    if (isVerified) {
      statusElement.textContent = "✅ Dokaz je valjan";
      statusElement.className = "verification-status valid";
    } else {
      statusElement.textContent = "❌ Dokaz NIJE valjan";
      statusElement.className = "verification-status invalid";
    }
  }

  // Funkcija za renderiranje glasačkih listića
  function renderBallots(ballots) {
    ballotListEl.innerHTML = "";
    if (ballots.length === 0) {
      ballotListEl.innerHTML = "<p>Nema zabilježenih glasova.</p>";
    }

    voteCountEl.textContent = ballots.length;

    ballots.forEach((ballot) => {
      const item = document.createElement("div");
      item.className = "ballot-item";

      const info = document.createElement("div");
      info.className = "ballot-info";
      info.innerHTML = `
                <strong>Kod za praćenje:</strong> <code>${
                  ballot.trackerCode
                }</code>
                <strong>Vrijeme:</strong> <code>${new Date(
                  ballot.createdAt
                ).toLocaleString("hr-HR")}</code>
            `;

      const actions = document.createElement("div");
      actions.className = "ballot-actions";
      const verifyBtn = document.createElement("button");
      verifyBtn.textContent = "Verificiraj dokaz";
      const statusDiv = document.createElement("div");
      statusDiv.className = "verification-status";

      verifyBtn.onclick = () => verifyProofInBrowser(ballot, statusDiv);

      actions.appendChild(verifyBtn);
      actions.appendChild(statusDiv);

      item.appendChild(info);
      item.appendChild(actions);
      ballotListEl.appendChild(item);
    });
  }

  // Funkcija za dohvaćanje podataka s backenda
  async function fetchBoardData() {
    try {
      ballotListEl.innerHTML = "<p>Dohvaćam podatke...</p>";
      const response = await fetch("http://localhost:3000/bulletin-board");
      if (!response.ok) throw new Error("Network response was not ok");
      allBallots = await response.json();
      renderBallots(allBallots);
    } catch (err) {
      console.error("Failed to fetch bulletin board data:", err);
      ballotListEl.innerHTML =
        '<p style="color:red">Greška pri dohvaćanju podataka s oglasne ploče.</p>';
    }
  }

  // Funkcija za pretragu
  function filterBallots() {
    const query = searchBox.value.toLowerCase();
    if (!query) {
      renderBallots(allBallots);
      return;
    }
    const filtered = allBallots.filter((b) =>
      b.trackerCode.toLowerCase().includes(query)
    );
    renderBallots(filtered);
  }

  // Inicijalizacija
  refreshBtn.addEventListener("click", fetchBoardData);
  searchBox.addEventListener("input", filterBallots);

  fetchVerificationKey().then(() => {
    fetchBoardData();
  });
});
