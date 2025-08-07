pragma circom 2.0.0;

/*
 * Ovaj krug dokazuje da je tajni 'vote' jednak jednom od
 * javno poznatih 'validCandidates'.
 * Koristi se "one-hot encoding" metoda.
 */
template Vote(numCandidates) {
    // ==== ULAZI ====
    signal input vote;
    signal input choice[numCandidates];
    signal input validCandidates[numCandidates];


    // ==== OGRANIČENJA (CONSTRAINTS) ====

    // --- 1. Provjeri je li 'choice' ispravan "one-hot" vektor ---
    var sum_of_choices = 0;
    for (var i = 0; i < numCandidates; i++) {
        // Svaki element mora biti bit (0 ili 1)
        choice[i] * (choice[i] - 1) === 0;
        // Zbroji sve elemente
        sum_of_choices = sum_of_choices + choice[i];
    }
    // Zbroj svih bitova mora biti točno 1
    sum_of_choices === 1;


    // --- 2. Provjeri odgovara li tajni 'vote' odabiru iz 'choice' ---
    // Ključni ispravak je ovdje.
    // Kreiramo N ograničenja. Za i-tog kandidata, ograničenje je:
    // choice[i] * (vote - validCandidates[i]) === 0
    //
    // Ako je choice[i] == 1 (odabrani kandidat):
    //   1 * (vote - validCandidates[i]) === 0   =>   vote === validCandidates[i]
    //
    // Ako je choice[i] == 0 (svi ostali kandidati):
    //   0 * (vote - validCandidates[i]) === 0   =>   0 === 0 (uvijek zadovoljeno)
    for (var i = 0; i < numCandidates; i++) {
        choice[i] * (vote - validCandidates[i]) === 0;
    }
}

component main {public [validCandidates]} = Vote(3);