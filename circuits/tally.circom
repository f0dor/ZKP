pragma circom 2.0.0;

/*
 * Ovaj krug dokazuje da je javni 'finalTally' vektor
 * zaista ispravan zbroj svih pojedinačnih 'ballots' vektora.
 */
template Tally(numBallots, numCandidates) {
    // ULAZI
    signal input ballots[numBallots][numCandidates];

    // Javni ulaz: Konačni zbroj za svakog kandidata
    signal input finalTally[numCandidates];


    // OGRANIČENJA
    
    for (var j = 0; j < numCandidates; j++) {
        var sum = 0;
        for (var i = 0; i < numBallots; i++) {
            sum = sum + ballots[i][j];
        }
        finalTally[j] === sum;
    }
}

// Instanciramo krug za maksimalno 10 glasova i 3 kandidata.
component main {public [finalTally]} = Tally(10, 3);