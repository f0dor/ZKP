document.addEventListener("DOMContentLoaded", () => {
  const ballotListEl = document.getElementById("ballot-list");
  const voteCountEl = document.getElementById("vote-count");
  const searchBox = document.getElementById("search-box");
  const refreshBtn = document.getElementById("refresh-btn");
  const searchBtn = document.getElementById("search-btn"); // Novi gumb
  let verificationKey = null;
  let allBallots = [];

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

  async function verifyProofInBrowser(ballotData, statusElement) {
    if (!verificationKey) {
      statusElement.textContent = "Ključ za verifikaciju nije učitan.";
      return;
    }
    statusElement.textContent = "Verificiram...";

    console.time("Vrijeme verifikacije na oglasnoj ploči (frontend)");
    const isVerified = await snarkjs.groth16.verify(
      verificationKey,
      ballotData.publicSignals,
      ballotData.proof
    );
    console.timeEnd("Vrijeme verifikacije na oglasnoj ploči (frontend)");

    if (isVerified) {
      statusElement.textContent = "✅ Dokaz je valjan";
      statusElement.className = "verification-status valid";
    } else {
      statusElement.textContent = "❌ Dokaz NIJE valjan";
      statusElement.className = "verification-status invalid";
    }
  }

  function renderBallots(ballotsToRender) {
    ballotListEl.innerHTML = "";
    if (ballotsToRender.length === 0) {
      ballotListEl.innerHTML =
        "<p>Nema zabilježenih glasova koji odgovaraju pretrazi.</p>";
    }

    voteCountEl.textContent = allBallots.length;
    const query = searchBox.value.trim().toLowerCase();

    ballotsToRender.forEach((ballot) => {
      const item = document.createElement("div");
      item.className = "ballot-item";

      if (query && ballot.trackerCode.toLowerCase().includes(query)) {
        item.classList.add("highlight");
      }

      const info = document.createElement("div");
      info.className = "ballot-info";
      info.innerHTML = `
                <strong>Kod za praćenje:</strong> <code>${
                  ballot.trackerCode
                }</code>
                <strong>Poništivač (Nullifier):</strong> <code>${
                  ballot.publicSignals[3]
                }</code>
                <strong>Vrijeme:</strong> <code>${new Date(
                  ballot.createdAt
                ).toLocaleString("hr-HR")}</code>
            `;

      const actions = document.createElement("div");
      actions.className = "ballot-actions";

      const verifyBtn = document.createElement("button");
      verifyBtn.textContent = "Verificiraj dokaz";

      const inspectBtn = document.createElement("button");
      inspectBtn.textContent = "Vidi Dokaz (JSON)";
      inspectBtn.className = "inspect-btn";

      const statusDiv = document.createElement("div");
      statusDiv.className = "verification-status";

      verifyBtn.onclick = () => verifyProofInBrowser(ballot, statusDiv);

      inspectBtn.onclick = () => {
        const dataToShow = {
          publicSignals: ballot.publicSignals,
          proof: ballot.proof,
        };
        alert(JSON.stringify(dataToShow, null, 2));
      };

      actions.appendChild(verifyBtn);
      actions.appendChild(inspectBtn);
      actions.appendChild(statusDiv);

      item.appendChild(info);
      item.appendChild(actions);
      ballotListEl.appendChild(item);
    });
  }

  async function fetchBoardData() {
    try {
      ballotListEl.innerHTML = "<p>Dohvaćam podatke...</p>";
      const response = await fetch("http://localhost:3000/bulletin-board");
      if (!response.ok) throw new Error("Network response was not ok");
      allBallots = await response.json();
      searchBox.value = "";
      renderBallots(allBallots);
    } catch (err) {
      console.error("Failed to fetch bulletin board data:", err);
      ballotListEl.innerHTML =
        '<p style="color:red">Greška pri dohvaćanju podataka s oglasne ploče.</p>';
    }
  }

  function findAndHighlight() {
    renderBallots(allBallots);
    const query = searchBox.value.trim().toLowerCase();
    if (query) {
      const foundItem = document.querySelector(".highlight");
      if (foundItem) {
        foundItem.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  refreshBtn.addEventListener("click", fetchBoardData);
  searchBtn.addEventListener("click", findAndHighlight);
  searchBox.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      findAndHighlight();
    }
  });

  fetchVerificationKey().then(fetchBoardData);
});
