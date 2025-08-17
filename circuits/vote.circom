pragma circom 2.0.0;

template AuthVote(numCandidates) {
    // ULAZI 
    // Privatni ulazi
    signal input vote;
    signal input choice[numCandidates];
    signal input voterSecret;

    // Javni ulazi
    signal input validCandidates[numCandidates];
    signal input nullifier;


    // OGRANIČENJA (CONSTRAINTS)

    // 1.Provjera valjanosti glasa (ostaje isto)
    var sum_of_choices = 0;
    for (var i = 0; i < numCandidates; i++) {
        choice[i] * (choice[i] - 1) === 0;
        sum_of_choices = sum_of_choices + choice[i];
    }
    sum_of_choices === 1;

    for (var i = 0; i < numCandidates; i++) {
        choice[i] * (vote - validCandidates[i]) === 0;
    }

    // 2.Provjera poništivača pomoću jednostavne funkcije
    // hash(secret) = secret * secret + secret
    signal secret_squared;
    secret_squared <== voterSecret * voterSecret;
    
    nullifier === secret_squared + voterSecret;
}

component main {public [validCandidates, nullifier]} = AuthVote(3);