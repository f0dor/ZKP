document.addEventListener("DOMContentLoaded", async () => {
  const startTallyBtn = document.getElementById("start-tally-btn");
  const tallyResultsEl = document.getElementById("tally-results");
  const finalTallyDisplay = document.getElementById("final-tally-display");
  const tallyStatus = document.getElementById("tally-status");
  const resetVotingBtn = document.getElementById("reset-voting-btn");

  let verificationKey = null;

  // Učitaj verifikacijski ključ za zbrajanje
  try {
    const response = await fetch("tally_verification_key.json");
    verificationKey = await response.json();
  } catch (e) {
    tallyStatus.innerHTML = `<p style="color:red">Greška: Nije moguće učitati ključ za verifikaciju zbroja.</p>`;
  }

  async function performTally() {
    try {
      tallyStatus.innerHTML =
        "<p>1. Dohvaćam sve glasove s oglasne ploče...</p>";
      const response = await fetch(
        `http://localhost:3000/bulletin-board?t=${new Date().getTime()}`
      );
      const ballots = await response.json();

      if (ballots.length > 10) {
        tallyStatus.innerHTML = `<p style="color:red">Greška: Ovaj demo krug podržava maksimalno 10 glasova.</p>`;
        return;
      }

      tallyStatus.innerHTML = `<p>2. Zbrajam "dekriptirane" glasove...</p>`;
      const finalTally = [0, 0, 0];
      const ballotVectors = [];

      for (const ballot of ballots) {
        const decryptedVector = JSON.parse(atob(ballot.voteVector));

        finalTally[0] += decryptedVector[0];
        finalTally[1] += decryptedVector[1];
        finalTally[2] += decryptedVector[2];
        ballotVectors.push(decryptedVector);
      }

      while (ballotVectors.length < 10) {
        ballotVectors.push([0, 0, 0]);
      }

      finalTallyDisplay.innerHTML = `
                <strong>Kandidat A:</strong> ${finalTally[0]} glasova<br>
                <strong>Kandidat B:</strong> ${finalTally[1]} glasova<br>
                <strong>Kandidat C:</strong> ${finalTally[2]} glasova
              `;
      tallyResultsEl.style.display = "block";
      tallyStatus.innerHTML =
        "<p>3. Generiram ZKP dokaz za ispravnost zbroja...</p>";
      const inputs = {
        ballots: ballotVectors,
        finalTally: finalTally.map((n) => BigInt(n)),
      };
      console.time("Vrijeme generiranja dokaza za zbroj (frontend)");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        "tally.wasm",
        "tally_final.zkey"
      );
      console.timeEnd("Vrijeme generiranja dokaza za zbroj (frontend)");
      tallyStatus.innerHTML = "<p>4. Verificiram ZKP dokaz zbroja...</p>";
      const isVerified = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );
      if (isVerified) {
        tallyStatus.innerHTML = `<p style="color: green;"><strong>✅ Uspjeh!</strong> Zbroj je kriptografski potvrđen kao točan.</p>`;
      } else {
        tallyStatus.innerHTML = `<p style="color: red;"><strong>❌ Greška!</strong> Verifikacija zbroja nije uspjela.</p>`;
      }
    } catch (err) {
      console.error(err);
      tallyStatus.innerHTML = `<p style="color: red;">Dogodila se greška: ${err.message}</p>`;
    }
  }

  async function resetElection() {
    if (
      !confirm(
        "Jeste li sigurni? Ovim ćete trajno obrisati sve glasove i započeti novi krug."
      )
    ) {
      return;
    }

    try {
      tallyStatus.innerHTML = "<p>Resetiram glasovanje...</p>";
      const response = await fetch("http://localhost:3000/reset", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      alert(result.message);
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      tallyStatus.innerHTML = `<p style="color: red;">Greška prilikom resetiranja: ${err.message}</p>`;
    }
  }

  startTallyBtn.addEventListener("click", performTally);
  resetVotingBtn.addEventListener("click", resetElection);
});
