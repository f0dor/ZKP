pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template AuthVote(numCandidates) {
    // ==== ULAZI ====
    // Privatni ulazi - poznati samo Dokazivaču (Proveru)
    signal input vote;
    signal input choice[numCandidates];
    signal input voterSecret; // Tajna je sada opet običan broj

    // Javni ulazi - poznati svima
    signal input validCandidates[numCandidates];
    signal input nullifier; // Poništivač je izlaz hasha, također običan broj


    // ==== OGRANIČENJA (CONSTRAINTS) ====

    // --- 1. Provjera valjanosti glasa (ostaje isto) ---
    var sum_of_choices = 0;
    for (var i = 0; i < numCandidates; i++) {
        choice[i] * (choice[i] - 1) === 0;
        sum_of_choices = sum_of_choices + choice[i];
    }
    sum_of_choices === 1;

    for (var i = 0; i < numCandidates; i++) {
        choice[i] * (vote - validCandidates[i]) === 0;
    }

    // --- 2. Provjera poništivača pomoću Poseidon hasha ---
    
    // Instanciramo Poseidon komponentu. Parametar '1' znači da hashiramo 1 element.
    component hasher = Poseidon(1);
    
    // Povezujemo ulaz hashera s tajnom glasača.
    hasher.inputs[0] <== voterSecret;
    
    // Namećemo ograničenje da javni 'nullifier' mora biti jednak izlazu iz Poseidon hashera.
    nullifier === hasher.out;
}

component main {public [validCandidates, nullifier]} = AuthVote(3);